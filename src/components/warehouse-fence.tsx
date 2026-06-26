"use client";

import { useMemo } from "react";
import * as THREE from "three";

import { WAREHOUSE_GROUND_Y } from "@/components/warehouse-environment";
import { getWarehouseFenceBounds, WAREHOUSE_FENCE } from "@/lib/warehouse-layout";

const postMaterial = new THREE.MeshStandardMaterial({
  color: "#a67c52",
  roughness: 0.88,
  metalness: 0,
});

const railMaterial = new THREE.MeshStandardMaterial({
  color: "#c4a574",
  roughness: 0.82,
  metalness: 0,
});

const postGeometry = new THREE.BoxGeometry(
  WAREHOUSE_FENCE.postSize,
  WAREHOUSE_FENCE.height,
  WAREHOUSE_FENCE.postSize,
);

const RAIL_HEIGHTS = [0.28, 0.72, 1.08];

function buildPostPositions(start: number, end: number, spacing: number): number[] {
  const span = end - start;
  const count = Math.max(2, Math.ceil(span / spacing) + 1);
  const step = span / (count - 1);
  return Array.from({ length: count }, (_, index) => start + index * step);
}

export function WarehouseFence() {
  const bounds = useMemo(() => getWarehouseFenceBounds(), []);
  const { minX, maxX, minZ, maxZ } = bounds;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const postY = WAREHOUSE_GROUND_Y + WAREHOUSE_FENCE.height / 2;
  const { postSpacing, railThickness } = WAREHOUSE_FENCE;

  const xPosts = useMemo(() => buildPostPositions(minX, maxX, postSpacing), [maxX, minX, postSpacing]);
  const zPosts = useMemo(() => buildPostPositions(minZ, maxZ, postSpacing), [maxZ, minZ, postSpacing]);

  return (
    <group>
      {xPosts.flatMap((x) =>
        [minZ, maxZ].map((z) => (
          <mesh
            key={`post-x-${x.toFixed(3)}-${z.toFixed(3)}`}
            position={[x, postY, z]}
            geometry={postGeometry}
            material={postMaterial}
            castShadow
            receiveShadow
          />
        )),
      )}
      {zPosts.flatMap((z) =>
        [minX, maxX].map((x) => (
          <mesh
            key={`post-z-${x.toFixed(3)}-${z.toFixed(3)}`}
            position={[x, postY, z]}
            geometry={postGeometry}
            material={postMaterial}
            castShadow
            receiveShadow
          />
        )),
      )}

      {RAIL_HEIGHTS.flatMap((railHeight) => {
        const y = WAREHOUSE_GROUND_Y + railHeight;
        return [
          <mesh
            key={`rail-x-south-${railHeight}`}
            position={[centerX, y, minZ]}
            material={railMaterial}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[width, railThickness, railThickness]} />
          </mesh>,
          <mesh
            key={`rail-x-north-${railHeight}`}
            position={[centerX, y, maxZ]}
            material={railMaterial}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[width, railThickness, railThickness]} />
          </mesh>,
          <mesh
            key={`rail-z-west-${railHeight}`}
            position={[minX, y, centerZ]}
            material={railMaterial}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[railThickness, railThickness, depth]} />
          </mesh>,
          <mesh
            key={`rail-z-east-${railHeight}`}
            position={[maxX, y, centerZ]}
            material={railMaterial}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[railThickness, railThickness, depth]} />
          </mesh>,
        ];
      })}

      <mesh
        position={[centerX, WAREHOUSE_GROUND_Y + WAREHOUSE_FENCE.height, minZ]}
        material={railMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width, railThickness, railThickness]} />
      </mesh>
      <mesh
        position={[centerX, WAREHOUSE_GROUND_Y + WAREHOUSE_FENCE.height, maxZ]}
        material={railMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width, railThickness, railThickness]} />
      </mesh>
      <mesh
        position={[minX, WAREHOUSE_GROUND_Y + WAREHOUSE_FENCE.height, centerZ]}
        material={railMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[railThickness, railThickness, depth]} />
      </mesh>
      <mesh
        position={[maxX, WAREHOUSE_GROUND_Y + WAREHOUSE_FENCE.height, centerZ]}
        material={railMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[railThickness, railThickness, depth]} />
      </mesh>
    </group>
  );
}
