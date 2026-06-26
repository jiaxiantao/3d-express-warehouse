"use client";

import { useEffect, useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

import { enumerateRackCategoryPlacements, getRackCategoryPlacementKey } from "@/lib/warehouse-rack-category";
import {
  getRackCategoryLabelTexture,
  getRackCategoryLabelTransform,
} from "@/lib/warehouse-rack-category-label";

function RackCategoryLabelPlane({
  placementKey,
  texture,
  transform,
}: {
  placementKey: string;
  texture: THREE.CanvasTexture;
  transform: ReturnType<typeof getRackCategoryLabelTransform>;
}) {
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.97,
        depthTest: true,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    [texture],
  );

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh
      key={placementKey}
      position={transform.position}
      quaternion={transform.quaternion}
      scale={[transform.planeWidth, transform.planeHeight, 1]}
      material={material}
      raycast={() => {}}
      renderOrder={2}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

export function WarehouseRackCategoryLabels() {
  const invalidate = useThree((state) => state.invalidate);
  const placements = useMemo(() => enumerateRackCategoryPlacements(), []);

  const labels = useMemo(
    () =>
      placements.map((placement) => {
        const texture = getRackCategoryLabelTexture(placement);
        return {
          key: getRackCategoryPlacementKey(placement.aisle, placement.end),
          texture,
          transform: getRackCategoryLabelTransform(placement, texture),
        };
      }),
    [placements],
  );

  useLayoutEffect(() => {
    invalidate();
  }, [invalidate, labels]);

  return (
    <group>
      {labels.map((label) => (
        <RackCategoryLabelPlane
          key={label.key}
          placementKey={label.key}
          texture={label.texture}
          transform={label.transform}
        />
      ))}
    </group>
  );
}
