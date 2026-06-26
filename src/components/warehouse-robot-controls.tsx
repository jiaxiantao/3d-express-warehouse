"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";

import { WAREHOUSE_ROBOT } from "@/lib/warehouse-robot-config";
import { getBodyForwardUnitVector, type RobotDriveState } from "@/lib/warehouse-robot-drive";
import { clampRobotWalkPosition, normalizeAngle, stepRobotTowardTarget, type RobotMoveTarget } from "@/lib/warehouse-robot-navigation";
import type { RobotMotionState } from "@/lib/warehouse-robot-motion";

export type RobotViewLookApi = {
  rotateByDelta: (deltaX: number, deltaY: number) => void;
};

type WarehouseRobotControlsProps = {
  pivotRef: React.RefObject<THREE.Group | null>;
  headRef: React.RefObject<THREE.Object3D | null>;
  movePathRef: React.RefObject<RobotMoveTarget[] | null>;
  motionRef: React.RefObject<RobotMotionState>;
  driveStateRef: React.RefObject<RobotDriveState | null>;
  viewLookApiRef: React.MutableRefObject<RobotViewLookApi>;
  blockGroundClickRef: React.RefObject<boolean>;
  robotView: boolean;
};

const headWorldPosition = new THREE.Vector3();
const DRAG_THRESHOLD_PX = 4;

function applyRobotCamera(camera: THREE.Camera, head: THREE.Object3D, bodyYaw: number) {
  head.getWorldPosition(headWorldPosition);
  camera.position.copy(headWorldPosition);
  camera.rotation.order = "YXZ";
  camera.rotation.y = bodyYaw + WAREHOUSE_ROBOT.lookYawOffset;
  camera.rotation.x = 0;
  camera.rotation.z = 0;
}

export function WarehouseRobotControls({
  pivotRef,
  headRef,
  movePathRef,
  motionRef,
  driveStateRef,
  viewLookApiRef,
  blockGroundClickRef,
  robotView,
}: WarehouseRobotControlsProps) {
  const { camera, gl, invalidate } = useThree();
  const synced = useRef(false);
  const moving = useRef(false);
  // 起步预热计时：累计「想要位移」的时长，达到阈值前只播动画不移动
  const moveWarmup = useRef(0);
  const prevPivotYaw = useRef<number>(WAREHOUSE_ROBOT.spawn.yaw);
  const pointerHeld = useRef(false);
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  // 第一人称：拖拽直接转动机器人朝向，使「视角」与机身一致（前进即朝所视方向）
  const rotateBodyYaw = useCallback(
    (deltaX: number) => {
      const pivot = pivotRef.current;
      if (!pivot) {
        return;
      }
      pivot.rotation.y -= deltaX * WAREHOUSE_ROBOT.lookSensitivity;
      invalidate();
    },
    [invalidate, pivotRef],
  );

  useEffect(() => {
    viewLookApiRef.current = {
      rotateByDelta: (deltaX) => rotateBodyYaw(deltaX),
    };
  }, [rotateBodyYaw, viewLookApiRef]);

  useEffect(() => {
    if (!robotView) {
      synced.current = false;
      pointerHeld.current = false;
      dragging.current = false;
      return;
    }

    const canvas = gl.domElement;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      pointerHeld.current = true;
      dragging.current = false;
      lastPointer.current = { x: event.clientX, y: event.clientY };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pointerHeld.current) {
        return;
      }

      const deltaX = event.clientX - lastPointer.current.x;
      if (!dragging.current && Math.abs(deltaX) < DRAG_THRESHOLD_PX) {
        return;
      }

      if (!dragging.current) {
        dragging.current = true;
        canvas.setPointerCapture(event.pointerId);
      }

      lastPointer.current = { x: event.clientX, y: event.clientY };
      rotateBodyYaw(deltaX);
    };

    const endPointer = (event: PointerEvent) => {
      if (!pointerHeld.current) {
        return;
      }
      const wasDragging = dragging.current;
      pointerHeld.current = false;
      dragging.current = false;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      if (wasDragging) {
        blockGroundClickRef.current = true;
        requestAnimationFrame(() => {
          blockGroundClickRef.current = false;
        });
      }
      invalidate();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);

    return () => {
      pointerHeld.current = false;
      dragging.current = false;
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endPointer);
      canvas.removeEventListener("pointercancel", endPointer);
    };
  }, [blockGroundClickRef, gl.domElement, invalidate, rotateBodyYaw, robotView]);

  // 优先于 Animator 更新 motion，避免同帧读到上一帧的 isMoving
  useFrame((_, rawDelta) => {
    const pivot = pivotRef.current;
    if (!pivot) {
      return;
    }

    // frameloop="demand" 空闲后首帧 delta 可能极大，钳制避免位置/转向瞬跳
    const delta = Math.min(rawDelta, WAREHOUSE_ROBOT.maxFrameDelta);
    const motion = motionRef.current;
    let needsRender = false;
    let moveSpeedRatio = 0;
    let moveSign = 0;
    let turnRate = 0;
    // 本帧是否「想要位移」：用于驱动起步预热计时与动画起播
    let translateIntent = false;
    const prevX = pivot.position.x;
    const prevZ = pivot.position.z;
    const prevYaw = pivot.rotation.y;

    const path = movePathRef.current;
    const target = path?.[0];
    const drive = driveStateRef.current;
    const driving = !!(drive && (drive.move || drive.turn));

    if (driving && drive) {
      // 手动驾驶：取消点击寻路
      movePathRef.current = null;

      // 先按住的左右键绕竖直轴转向（像游戏里转动人物/镜头）
      if (drive.turn) {
        const turnSign = drive.turn === "left" ? 1 : -1;
        pivot.rotation.y = prevYaw + turnSign * WAREHOUSE_ROBOT.turnSpeed * delta;
      }

      // 再沿（转向后的）机身朝向前进/后退
      if (drive.move) {
        moveSign = drive.move === "forward" ? 1 : -1;
        translateIntent = true;
        moveWarmup.current += delta;
        // 预热满 1 秒后才真正位移（动画先动）
        if (moveWarmup.current >= WAREHOUSE_ROBOT.moveWarmupSeconds) {
          const unit = getBodyForwardUnitVector(pivot.rotation.y, drive.move);
          const step = WAREHOUSE_ROBOT.moveSpeed * delta;
          const next = stepRobotTowardTarget(
            pivot.position.x,
            pivot.position.z,
            pivot.position.x + unit.x,
            pivot.position.z + unit.z,
            step,
          );
          pivot.position.x = next.x;
          pivot.position.z = next.z;
        }
      }

      moving.current = true;
      needsRender = true;
    }

    if (!driving && target) {
      const dx = target.x - pivot.position.x;
      const dz = target.z - pivot.position.z;
      const distance = Math.hypot(dx, dz);

      if (distance > WAREHOUSE_ROBOT.arriveDistance) {
        const headingYaw = Math.atan2(dx, dz);

        const yawError = normalizeAngle(headingYaw - prevYaw);
        const maxTurn = WAREHOUSE_ROBOT.turnSpeed * delta;
        pivot.rotation.y = prevYaw + THREE.MathUtils.clamp(yawError, -maxTurn, maxTurn);

        if (Math.abs(yawError) <= WAREHOUSE_ROBOT.turnAlignThreshold) {
          moveSign = 1;
          translateIntent = true;
          moveWarmup.current += delta;
          // 转向对齐后预热满 1 秒才前进（动画先动）
          if (moveWarmup.current >= WAREHOUSE_ROBOT.moveWarmupSeconds) {
            const step = WAREHOUSE_ROBOT.moveSpeed * delta;
            const next = stepRobotTowardTarget(
              pivot.position.x,
              pivot.position.z,
              target.x,
              target.z,
              step,
            );
            pivot.position.x = next.x;
            pivot.position.z = next.z;
          }
        }

        moving.current = true;
        needsRender = true;
      } else {
        const arrived = clampRobotWalkPosition(target.x, target.z);
        pivot.position.x = arrived.x;
        pivot.position.z = arrived.z;

        if (path && path.length > 1) {
          movePathRef.current = path.slice(1);
          moving.current = true;
        } else {
          movePathRef.current = null;
          moving.current = false;
        }
        needsRender = true;
      }
    } else if (!driving) {
      moving.current = false;
    }

    // 没有位移意图（松开按键/转向中/到站）则清零预热，下次起步重新蓄力 1 秒
    if (!translateIntent) {
      moveWarmup.current = 0;
    }

    const moveDx = pivot.position.x - prevX;
    const moveDz = pivot.position.z - prevZ;
    const moved = Math.hypot(moveDx, moveDz);

    if (moved > 0.0001) {
      moveSpeedRatio = Math.min(1, moved / Math.max(WAREHOUSE_ROBOT.moveSpeed * delta * 0.9, 0.0001));
    }

    const head = headRef.current;
    if (robotView && head) {
      if (!synced.current) {
        const grounded = clampRobotWalkPosition(pivot.position.x, pivot.position.z);
        pivot.position.x = grounded.x;
        pivot.position.z = grounded.z;
        synced.current = true;
      }
      applyRobotCamera(camera, head, pivot.rotation.y);
      needsRender = true;
    }

    turnRate = pivot.rotation.y - prevPivotYaw.current;
    prevPivotYaw.current = pivot.rotation.y;

    const grounded = clampRobotWalkPosition(pivot.position.x, pivot.position.z);
    if (grounded.x !== pivot.position.x || grounded.z !== pivot.position.z) {
      pivot.position.x = grounded.x;
      pivot.position.z = grounded.z;
      needsRender = true;
    }

    const translating = moved > 0.0001;
    // 一旦下达前进/后退指令立即起播动画，不必等到位移被测量出来（消除「已移动腿不动」）
    const driveMoving = moveSign !== 0;
    if (motion) {
      motion.isMoving = translating || driveMoving;
      motion.speed = moveSpeedRatio;
      motion.moveSign = moveSign !== 0 ? moveSign : translating ? 1 : 0;
      motion.turnRate = turnRate;
    }

    if (needsRender || moving.current || motion?.isMoving || robotView || driving || movePathRef.current?.length) {
      invalidate();
    }
  }, -1);

  return null;
}
