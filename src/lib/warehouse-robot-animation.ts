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

export function setupRobotAnimation(
  model: THREE.Group,
  clips: THREE.AnimationClip[],
  leanTarget: THREE.Object3D,
): RobotAnimationRig | null {
  const clip = resolveWalkClip(clips);
  if (!clip) {
    return null;
  }

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
