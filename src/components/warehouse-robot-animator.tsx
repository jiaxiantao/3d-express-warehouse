"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import type { RobotAnimationRig } from "@/lib/warehouse-robot-animation";
import type { RobotMotionState } from "@/lib/warehouse-robot-motion";
import { WAREHOUSE_ROBOT } from "@/lib/warehouse-robot-config";

type WarehouseRobotAnimatorProps = {
  rig: RobotAnimationRig | null;
  motionRef: React.RefObject<RobotMotionState>;
};

/** 起播并跳过片段开头的前摇（按相位定位到迈步阶段） */
function startWalkAtPhase(walkAction: THREE.AnimationAction, phase: number) {
  walkAction.reset().setEffectiveWeight(1).play();
  walkAction.time = walkAction.getClip().duration * phase;
}

export function WarehouseRobotAnimator({ rig, motionRef }: WarehouseRobotAnimatorProps) {
  const invalidate = useThree((state) => state.invalidate);
  const wasWalking = useRef(false);

  useEffect(() => {
    if (!rig) {
      return;
    }
    return () => {
      rig.walkAction.fadeOut(0);
      rig.walkAction.stop();
    };
  }, [rig]);

  useFrame((_, rawDelta) => {
    if (!rig) {
      return;
    }

    const delta = Math.min(rawDelta, WAREHOUSE_ROBOT.maxFrameDelta);
    const motion = motionRef.current;
    const { mixer, walkAction } = rig;
    const {
      walkTimeScaleMin,
      walkTimeScaleMax,
      walkFadeOut,
      walkStartPhase,
    } = WAREHOUSE_ROBOT.locomotion;

    const shouldWalk = Boolean(motion?.isMoving);
    let animating = false;

    if (shouldWalk) {
      if (!wasWalking.current) {
        // 起步：立即起播，并跳过片段开头的前摇，避免「已移动但腿不动」
        startWalkAtPhase(walkAction, walkStartPhase);
      } else if (!walkAction.isRunning()) {
        startWalkAtPhase(walkAction, walkStartPhase);
      }

      const speed = Math.max(motion?.speed ?? 0, 0.35);
      // 后退时倒放行走片段，避免「倒着走却前进迈步」
      const directionSign = (motion?.moveSign ?? 1) < 0 ? -1 : 1;
      walkAction.setEffectiveTimeScale(
        directionSign * THREE.MathUtils.lerp(walkTimeScaleMin, walkTimeScaleMax, speed),
      );
      animating = true;
    } else if (wasWalking.current && walkAction.isRunning()) {
      // 仅在「从行走变为静止」时淡出一次，勿每帧重复 fadeOut
      walkAction.fadeOut(walkFadeOut);
      animating = walkAction.getEffectiveWeight() > 0.02;
    }

    wasWalking.current = shouldWalk;
    mixer.update(delta);

    if (animating || walkAction.getEffectiveWeight() > 0.01) {
      invalidate();
    }
  });

  return null;
}
