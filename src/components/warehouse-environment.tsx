"use client";

import * as THREE from "three";

export const WAREHOUSE_GROUND_Y = 0;

const floorGeometry = new THREE.PlaneGeometry(40, 32);
const floorMaterial = new THREE.MeshLambertMaterial({
  color: "#3d4f6e",
});

function createFloorGridGeometry(size: number, divisions: number) {
  const geometry = new THREE.BufferGeometry();
  const step = size / divisions;
  const half = size / 2;
  const vertices: number[] = [];

  for (let i = 0; i <= divisions; i += 1) {
    const offset = -half + i * step;
    vertices.push(-half, 0, offset, half, 0, offset);
    vertices.push(offset, 0, -half, offset, 0, half);
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  return geometry;
}

const floorGridGeometry = createFloorGridGeometry(36, 18);
const gridMaterial = new THREE.LineBasicMaterial({ color: "#4b5f82", transparent: true, opacity: 0.5 });

export function WarehouseFloor() {
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, WAREHOUSE_GROUND_Y - 0.01, 0]}
        geometry={floorGeometry}
        material={floorMaterial}
      />
      <lineSegments
        geometry={floorGridGeometry}
        material={gridMaterial}
        position={[0, WAREHOUSE_GROUND_Y + 0.002, 0]}
      />
    </group>
  );
}

export function WarehouseLights() {
  return (
    <>
      <ambientLight intensity={1.45} color="#f1f5f9" />
      <hemisphereLight args={["#e0f2fe", "#334155", 0.85]} />
      <directionalLight position={[12, 18, 10]} intensity={1.6} color="#ffffff" />
      <directionalLight position={[-8, 10, -6]} intensity={0.75} color="#dbeafe" />
      <pointLight position={[0, 8, 0]} intensity={0.55} distance={35} color="#a5f3fc" />
    </>
  );
}
