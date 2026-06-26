"use client";

import { useCallback, useMemo, useState } from "react";
import { type ThreeEvent, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { WAREHOUSE_GROUND_Y } from "@/components/warehouse-environment";
import {
  GroundRipples,
  type GroundRippleInstance,
} from "@/components/warehouse-ground-ripple";
import { getWarehouseFenceBounds, isPointInsideWarehouseFence } from "@/lib/warehouse-layout";
import { planRobotWalkPath, type RobotMoveTarget } from "@/lib/warehouse-robot-navigation";

type WarehouseRobotFloorNavProps = {
  pivotRef: React.RefObject<THREE.Group | null>;
  movePathRef: React.RefObject<RobotMoveTarget[] | null>;
  blockGroundClickRef: React.RefObject<boolean>;
  onGroundClick?: () => void;
};

export function WarehouseRobotFloorNav({
  pivotRef,
  movePathRef,
  blockGroundClickRef,
  onGroundClick,
}: WarehouseRobotFloorNavProps) {
  const invalidate = useThree((state) => state.invalidate);
  const [ripples, setRipples] = useState<GroundRippleInstance[]>([]);

  const { floorNavGeometry, floorNavCenterX, floorNavCenterZ } = useMemo(() => {
    const bounds = getWarehouseFenceBounds();
    return {
      floorNavGeometry: new THREE.PlaneGeometry(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ),
      floorNavCenterX: (bounds.minX + bounds.maxX) / 2,
      floorNavCenterZ: (bounds.minZ + bounds.maxZ) / 2,
    };
  }, []);

  const removeRipple = useCallback((id: string) => {
    setRipples((prev) => prev.filter((ripple) => ripple.id !== id));
  }, []);

  const handleFloorClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (blockGroundClickRef.current) {
        return;
      }

      if (!isPointInsideWarehouseFence(event.point.x, event.point.z)) {
        return;
      }

      event.stopPropagation();
      const pivot = pivotRef.current;
      const fromX = pivot?.position.x ?? 0;
      const fromZ = pivot?.position.z ?? 0;
      const path = planRobotWalkPath(fromX, fromZ, event.point.x, event.point.z);
      if (path.length === 0) {
        return;
      }

      movePathRef.current = path;

      const destination = path[path.length - 1];
      const rippleId = `${destination.x.toFixed(3)}-${destination.z.toFixed(3)}-${performance.now()}`;
      setRipples((prev) => [...prev, { id: rippleId, x: destination.x, z: destination.z }]);
      onGroundClick?.();
      invalidate();
    },
    [blockGroundClickRef, invalidate, movePathRef, onGroundClick, pivotRef],
  );

  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[floorNavCenterX, WAREHOUSE_GROUND_Y + 0.004, floorNavCenterZ]}
        geometry={floorNavGeometry}
        renderOrder={-2}
        onClick={handleFloorClick}
      >
        <meshBasicMaterial visible={false} depthWrite={false} />
      </mesh>
      <GroundRipples ripples={ripples} onRemove={removeRipple} />
    </>
  );
}
