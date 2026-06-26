import * as THREE from "three";

import { WAREHOUSE_ROBOT } from "@/lib/warehouse-robot-config";

export type RobotAnimationRig = {
  mixer: THREE.AnimationMixer;
  walkAction: THREE.AnimationAction;
  /** 骨骼动画根节点（GLTF scene） */
  body: THREE.Group;
  /** 用于转弯倾斜，避免改写缓存的 GLTF 根节点旋转 */
  leanTarget: THREE.Object3D;
};

export function resolveWalkClip(clips: THREE.AnimationClip[]): THREE.AnimationClip | null {
  if (clips.length === 0) {
    return null;
  }

  const preferred = WAREHOUSE_ROBOT.walkClipName;
  return clips.find((clip) => clip.name === preferred) ?? clips[0] ?? null;
}

const SUBCLIP_FPS = 30;

/**
 * 把行走片段裁成只剩迈步主体：去掉开头前摇 / 结尾后摇的静止帧，
 * 这样 LoopRepeat 循环时不会回放死区，消除「行走却无骨骼动画」的真空期。
 */
export function trimWalkClip(source: THREE.AnimationClip): THREE.AnimationClip {
  const { walkStartPhase, walkEndPhase } = WAREHOUSE_ROBOT.locomotion;
  if (walkStartPhase <= 0 && walkEndPhase >= 1) {
    return source;
  }

  const totalFrames = source.duration * SUBCLIP_FPS;
  const startFrame = Math.floor(walkStartPhase * totalFrames);
  // +1 确保末尾关键帧不被 subclip 的 `frame >= endFrame` 规则排除
  const endFrame = Math.ceil(walkEndPhase * totalFrames) + 1;
  if (endFrame - startFrame < 2) {
    return source;
  }

  return THREE.AnimationUtils.subclip(source, source.name, startFrame, endFrame, SUBCLIP_FPS);
}

export function setupRobotAnimation(
  model: THREE.Group,
  clips: THREE.AnimationClip[],
  leanTarget: THREE.Object3D,
): RobotAnimationRig | null {
  const source = resolveWalkClip(clips);
  if (!source) {
    return null;
  }

  const clip = trimWalkClip(source);
  const mixer = new THREE.AnimationMixer(model);
  const walkAction = mixer.clipAction(clip);
  walkAction.setLoop(THREE.LoopRepeat, Infinity);
  walkAction.clampWhenFinished = false;
  walkAction.enabled = true;
  walkAction.stop();

  return { mixer, walkAction, body: model, leanTarget };
}

export function disposeRobotAnimation(rig: RobotAnimationRig) {
  rig.walkAction.stop();
  rig.mixer.stopAllAction();
  rig.mixer.uncacheRoot(rig.body);
}
