"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { WAREHOUSE_GROUND_Y } from "@/components/warehouse-environment";

const RIPPLE_DURATION_MS = 1400;
const RIPPLE_STAGGER_MS = 180;
const RIPPLE_RING_COUNT = 3;

type GroundRippleProps = {
  x: number;
  z: number;
  onDone: () => void;
};

function GroundRipple({ x, z, onDone }: GroundRippleProps) {
  const invalidate = useThree((state) => state.invalidate);
  const startedAt = useRef(0);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);

  useLayoutEffect(() => {
    startedAt.current = performance.now();
  }, []);
  const materials = useMemo(
    () =>
      Array.from(
        { length: RIPPLE_RING_COUNT },
        () =>
          new THREE.MeshBasicMaterial({
            color: "#5eead4",
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            toneMapped: false,
          }),
      ),
    [],
  );

  useEffect(
    () => () => {
      materials.forEach((material) => material.dispose());
    },
    [materials],
  );

  useFrame(() => {
    const elapsed = performance.now() - startedAt.current;
    if (elapsed >= RIPPLE_DURATION_MS + RIPPLE_STAGGER_MS * (RIPPLE_RING_COUNT - 1)) {
      onDone();
      return;
    }

    meshes.current.forEach((mesh, index) => {
      const material = materials[index];
      if (!mesh || !material) {
        return;
      }

      const localElapsed = elapsed - index * RIPPLE_STAGGER_MS;
      if (localElapsed < 0) {
        mesh.visible = false;
        return;
      }

      mesh.visible = true;
      const progress = localElapsed / RIPPLE_DURATION_MS;
      const scale = 0.25 + progress * 5.2;
      mesh.scale.set(scale, scale, 1);
      material.opacity = Math.max(0, (1 - progress) * 0.52 * (1 - progress * 0.35));
    });

    invalidate();
  });

  return (
    <group position={[x, WAREHOUSE_GROUND_Y + 0.018, z]} rotation={[-Math.PI / 2, 0, 0]}>
      {materials.map((material, index) => (
        <mesh
          key={index}
          ref={(node) => {
            meshes.current[index] = node;
          }}
          renderOrder={5}
          material={material}
        >
          <ringGeometry args={[0.32, 0.5, 56]} />
        </mesh>
      ))}
    </group>
  );
}

export type GroundRippleInstance = {
  id: string;
  x: number;
  z: number;
};

export function GroundRipples({
  ripples,
  onRemove,
}: {
  ripples: GroundRippleInstance[];
  onRemove: (id: string) => void;
}) {
  return (
    <>
      {ripples.map((ripple) => (
        <GroundRipple key={ripple.id} x={ripple.x} z={ripple.z} onDone={() => onRemove(ripple.id)} />
      ))}
    </>
  );
}
