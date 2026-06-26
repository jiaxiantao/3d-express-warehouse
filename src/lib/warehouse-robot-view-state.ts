import { getWarehouseFenceBounds } from "@/lib/warehouse-layout";
import { WAREHOUSE_ROBOT } from "@/lib/warehouse-robot-config";
import * as THREE from "three";

export type ThirdPersonOrbitState = {
  yawOffset: number;
  pitch: number;
  distance: number;
};

export type GodViewOrbitState = {
  yaw: number;
  pitch: number;
  distance: number;
};

export function createThirdPersonOrbitState(): ThirdPersonOrbitState {
  return {
    yawOffset: 0,
    pitch: WAREHOUSE_ROBOT.thirdPerson.defaultPitch as number,
    distance: WAREHOUSE_ROBOT.thirdPerson.distance,
  };
}

export function createGodViewOrbitState(): GodViewOrbitState {
  return {
    yaw: WAREHOUSE_ROBOT.godView.defaultYaw as number,
    pitch: WAREHOUSE_ROBOT.godView.defaultPitch as number,
    distance: WAREHOUSE_ROBOT.godView.distance,
  };
}

export function getGodViewTarget(out = new THREE.Vector3()) {
  const bounds = getWarehouseFenceBounds();
  out.set(
    (bounds.minX + bounds.maxX) / 2,
    WAREHOUSE_ROBOT.godView.targetHeight,
    (bounds.minZ + bounds.maxZ) / 2,
  );
  return out;
}
