"use client";

import { useLoader, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinnedScene } from "three/examples/jsm/utils/SkeletonUtils.js";

import { getPublicAssetUrl } from "@/lib/public-asset";
import { WAREHOUSE_ROBOT } from "@/lib/warehouse-robot-config";
import {
  disposeRobotAnimation,
  setupRobotAnimation,
  type RobotAnimationRig,
} from "@/lib/warehouse-robot-animation";
import type { RobotMotionState } from "@/lib/warehouse-robot-motion";
import { WAREHOUSE_GROUND_Y } from "@/components/warehouse-environment";
import { WarehouseRobotAnimator } from "@/components/warehouse-robot-animator";

const robotModelUrl = getPublicAssetUrl(WAREHOUSE_ROBOT.modelUrl);
useLoader.preload(GLTFLoader, robotModelUrl);

type WarehouseRobotProps = {
  pivotRef: React.RefObject<THREE.Group | null>;
  headRef: React.RefObject<THREE.Object3D | null>;
  motionRef: React.RefObject<RobotMotionState>;
  /** 第一人称时隐藏机身 mesh，第三人称始终显示 */
  modelVisible?: boolean;
};

export type RobotEyeAnchor = {
  x: number;
  y: number;
  z: number;
};

type PreparedRobot = {
  root: THREE.Group;
  eyeAnchorNode: THREE.Object3D;
  animationRig: RobotAnimationRig | null;
};

const vertexScratch = new THREE.Vector3();
const boundsScratch = new THREE.Box3();
const centerScratch = new THREE.Vector3();
const sizeScratch = new THREE.Vector3();

const EYE_BONE_NAMES = [
  "NeckPistonsL003_0119",
  "NeckPistonsR003_0121",
  "NeckPistonsL002_0123",
  "NeckPistonsR002_0125",
  "NeckPistonsL_0124",
  "NeckPistonsR_0126",
] as const;

/** GLTF bind pose 竖直高度兜底（POSITION accessor Y 跨度） */
const ROBOT_BIND_HEIGHT = 2.185;

type SkinnedPosedStats = {
  /** 脚底接触面（按分位数取的最低 Y） */
  contactY: number;
  /** 已变形网格的水平包围盒中心 X（自转轴对齐用） */
  centerX: number;
  /** 已变形网格的水平包围盒中心 Z（自转轴对齐用） */
  centerZ: number;
};

/**
 * 取主蒙皮网格在「当前姿态(posed)」下的世界坐标统计。
 * 只看身体网格本身，避免杂散/辅助网格把中心带偏，从而保证自转轴穿过机身。
 */
function getSkinnedPosedStats(mesh: THREE.SkinnedMesh, percentile: number): SkinnedPosedStats {
  mesh.skeleton?.update();
  mesh.updateWorldMatrix(true, false);
  const count = mesh.geometry.attributes.position.count;
  if (count === 0) {
    return { contactY: 0, centerX: 0, centerZ: 0 };
  }

  const ys: number[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < count; i += 1) {
    mesh.getVertexPosition(i, vertexScratch);
    vertexScratch.applyMatrix4(mesh.matrixWorld);
    ys.push(vertexScratch.y);
    if (vertexScratch.x < minX) minX = vertexScratch.x;
    if (vertexScratch.x > maxX) maxX = vertexScratch.x;
    if (vertexScratch.z < minZ) minZ = vertexScratch.z;
    if (vertexScratch.z > maxZ) maxZ = vertexScratch.z;
  }

  ys.sort((a, b) => a - b);
  const index = Math.min(ys.length - 1, Math.max(0, Math.floor(ys.length * percentile)));

  return {
    contactY: ys[index] ?? 0,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
  };
}

function resolveSkinnedMesh(root: THREE.Object3D): THREE.SkinnedMesh | null {
  let skinned: THREE.SkinnedMesh | null = null;
  root.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh && !skinned) {
      skinned = child;
    }
  });
  return skinned;
}

function resolveEyeNode(model: THREE.Object3D): THREE.Object3D | null {
  for (const name of EYE_BONE_NAMES) {
    const node = model.getObjectByName(name);
    if (node) {
      return node;
    }
  }

  let topBone: THREE.Object3D | null = null;
  let topY = -Infinity;
  model.traverse((child) => {
    if (!(child instanceof THREE.Bone)) {
      return;
    }
    const worldY = child.getWorldPosition(new THREE.Vector3()).y;
    if (worldY > topY) {
      topY = worldY;
      topBone = child;
    }
  });
  return topBone;
}

function attachEyeAnchorNode(eyeBone: THREE.Object3D | null, leanTarget: THREE.Group, fallbackHeight: number) {
  const eyeAnchorNode = new THREE.Object3D();
  eyeAnchorNode.name = "RobotEyeAnchor";
  const { eyeOffset } = WAREHOUSE_ROBOT;

  if (eyeBone) {
    eyeAnchorNode.position.set(eyeOffset.x, eyeOffset.y, eyeOffset.z);
    eyeBone.add(eyeAnchorNode);
    return eyeAnchorNode;
  }

  leanTarget.add(eyeAnchorNode);
  eyeAnchorNode.position.set(eyeOffset.x, fallbackHeight * 0.92 + eyeOffset.y, eyeOffset.z);
  return eyeAnchorNode;
}

function finishSkinnedMeshSetup(root: THREE.Object3D) {
  root.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh) {
      child.frustumCulled = false;
      child.castShadow = true;
      child.receiveShadow = true;
      child.visible = true;
      // 勿调用 pose()：该 GLB 的 bind pose 已是站立姿态，pose() 会导致蒙皮错位
      child.skeleton?.update();
      child.computeBoundingBox();
      child.computeBoundingSphere();
      return;
    }

    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;
    child.visible = true;
  });
}

function expandBoundsFromMeshes(root: THREE.Object3D, target: THREE.Box3) {
  target.makeEmpty();
  root.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh || child instanceof THREE.Mesh) {
      child.updateWorldMatrix(true, false);
      target.expandByObject(child);
    }
  });
}

function prepareRobotModel(scene: THREE.Group, clips: THREE.AnimationClip[]): PreparedRobot {
  finishSkinnedMeshSetup(scene);
  scene.updateMatrixWorld(true);

  // 须在缩放前量取包围盒；缩放后 SkinnedMesh 的 expandByObject 会得到错误的 Y 范围
  boundsScratch.makeEmpty();
  expandBoundsFromMeshes(scene, boundsScratch);
  boundsScratch.getSize(sizeScratch);
  const bindHeight =
    sizeScratch.y >= 1 && sizeScratch.y <= 4 ? sizeScratch.y : ROBOT_BIND_HEIGHT;
  const modelScale = WAREHOUSE_ROBOT.targetHeight / Math.max(bindHeight, 0.001);

  boundsScratch.getCenter(centerScratch);
  const modelOffset = new THREE.Vector3(
    -centerScratch.x * modelScale,
    -boundsScratch.min.y * modelScale,
    -centerScratch.z * modelScale,
  );

  const leanTarget = new THREE.Group();
  leanTarget.name = "RobotLeanTarget";

  // 缩放必须写在含骨骼的根节点上；父级 Group 缩放会导致蒙皮顶点错位
  scene.scale.setScalar(modelScale);
  scene.position.copy(modelOffset);
  scene.updateMatrixWorld(true);

  // 以主蒙皮网格（身体）的实际姿态做二次校正：
  // - Y：包围盒最低点常低于可见脚底，按分位数下沉贴地
  // - X/Z：把机身水平中心对齐到 pivot 原点，确保转弯绕自身竖直轴自转而非公转
  const skinnedMesh = resolveSkinnedMesh(scene);
  if (skinnedMesh) {
    const stats = getSkinnedPosedStats(skinnedMesh, WAREHOUSE_ROBOT.footContactPercentile);
    if (stats.contactY > 0.001) {
      scene.position.y -= stats.contactY;
    }
    scene.position.x -= stats.centerX;
    scene.position.z -= stats.centerZ;
  }
  if (WAREHOUSE_ROBOT.footSinkY !== 0) {
    scene.position.y -= WAREHOUSE_ROBOT.footSinkY;
  }

  scene.updateMatrixWorld(true);
  finishSkinnedMeshSetup(scene);
  leanTarget.add(scene);

  const eyeBone = resolveEyeNode(scene);
  const eyeAnchorNode = attachEyeAnchorNode(eyeBone, leanTarget, bindHeight * modelScale);

  const animationRig = setupRobotAnimation(scene, clips, leanTarget);

  return {
    root: leanTarget,
    eyeAnchorNode,
    animationRig,
  };
}

export function WarehouseRobot({ pivotRef, headRef, motionRef, modelVisible = true }: WarehouseRobotProps) {
  const invalidate = useThree((state) => state.invalidate);
  const gltf = useLoader(GLTFLoader, robotModelUrl) as GLTF;
  const { root, eyeAnchorNode, animationRig } = useMemo(() => {
    const scene = cloneSkinnedScene(gltf.scene) as THREE.Group;
    return prepareRobotModel(scene, gltf.animations);
  }, [gltf.animations, gltf.scene]);

  useLayoutEffect(() => {
    if (headRef) {
      headRef.current = eyeAnchorNode;
    }
  }, [eyeAnchorNode, headRef]);

  useLayoutEffect(() => {
    root.updateMatrixWorld(true);
    invalidate();
  }, [invalidate, root]);

  useEffect(() => {
    let frames = 0;
    let frameId = 0;
    const tick = () => {
      invalidate();
      frames += 1;
      if (frames < 36) {
        frameId = requestAnimationFrame(tick);
      }
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [animationRig, invalidate, root]);

  useEffect(
    () => () => {
      if (animationRig) {
        disposeRobotAnimation(animationRig);
      }
    },
    [animationRig],
  );

  return (
    <group
      ref={pivotRef}
      position={[WAREHOUSE_ROBOT.spawn.x, WAREHOUSE_GROUND_Y, WAREHOUSE_ROBOT.spawn.z]}
      rotation={[0, WAREHOUSE_ROBOT.spawn.yaw, 0]}
    >
      <primitive object={root} visible={modelVisible} />
      <WarehouseRobotAnimator rig={animationRig} motionRef={motionRef} />
    </group>
  );
}
