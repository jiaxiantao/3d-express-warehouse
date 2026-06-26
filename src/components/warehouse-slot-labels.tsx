"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import {
  getSlotMotionState,
  isActionRunning,
  type SlotActionState,
  type WarehouseActionPulse,
} from "@/lib/warehouse-animations";
import {
  getSlotLabelOpacity,
  getSlotLabelTexture,
  getSlotLabelTransform,
} from "@/lib/warehouse-slot-label";
import type { SlotStatus, WarehouseSlot } from "@/lib/warehouse-types";

type WarehouseSlotLabelsProps = {
  slots: WarehouseSlot[];
  highlightedFilter: SlotStatus | "all";
  hoveredIndex: number | null;
  actionPulse: WarehouseActionPulse | null;
};

function SlotLabelPlane({
  slot,
  slotIndex,
  highlightedFilter,
  hoveredIndex,
  actionStateRef,
}: {
  slot: WarehouseSlot;
  slotIndex: number;
  highlightedFilter: SlotStatus | "all";
  hoveredIndex: number | null;
  actionStateRef: React.RefObject<SlotActionState | null>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => getSlotLabelTexture(slot), [slot]);
  const opacity = getSlotLabelOpacity(slot, highlightedFilter);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity,
        depthTest: true,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    [opacity, texture],
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    const motion = getSlotMotionState(
      slotIndex,
      slot.id,
      hoveredIndex,
      actionStateRef.current,
      performance.now(),
    );
    const transform = getSlotLabelTransform(slot, texture, motion);
    mesh.position.set(...transform.position);
    mesh.quaternion.set(...transform.quaternion);
    mesh.scale.set(transform.planeWidth, transform.planeHeight, 1);
  });

  return (
    <mesh ref={meshRef} material={material} raycast={() => {}}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

export function WarehouseSlotLabels({
  slots,
  highlightedFilter,
  hoveredIndex,
  actionPulse,
}: WarehouseSlotLabelsProps) {
  const invalidate = useThree((state) => state.invalidate);
  const actionStateRef = useRef<SlotActionState | null>(null);

  useEffect(() => {
    if (!actionPulse) {
      return;
    }
    actionStateRef.current = {
      slotId: actionPulse.slotId,
      action: actionPulse.action,
      startedAt: performance.now(),
    };
    invalidate();
  }, [actionPulse, invalidate]);

  useLayoutEffect(() => {
    invalidate();
    let frames = 0;
    const tick = () => {
      invalidate();
      frames += 1;
      if (frames < 16) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }, [highlightedFilter, invalidate, slots]);

  useFrame(() => {
    const action = actionStateRef.current;
    const animating =
      hoveredIndex !== null ||
      (action !== null && isActionRunning(action.startedAt));
    if (animating) {
      invalidate();
    }
  });

  return (
    <group>
      {slots.map((slot, slotIndex) => (
        <SlotLabelPlane
          key={slot.id}
          slot={slot}
          slotIndex={slotIndex}
          highlightedFilter={highlightedFilter}
          hoveredIndex={hoveredIndex}
          actionStateRef={actionStateRef}
        />
      ))}
    </group>
  );
}
