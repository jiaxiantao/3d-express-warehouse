"use client";

import * as THREE from "three";

export const WAREHOUSE_GROUND_Y = 0;

const floorGeometry = new THREE.PlaneGeometry(40, 32);
const floorMaterial = new THREE.MeshStandardMaterial({
  color: "#3a4d6a",
  roughness: 0.88,
  metalness: 0.06,
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
const gridMaterial = new THREE.LineBasicMaterial({ color: "#4b5f82", transparent: true, opacity: 0.45 });

export function WarehouseFloor() {
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, WAREHOUSE_GROUND_Y - 0.01, 0]}
        geometry={floorGeometry}
        material={floorMaterial}
        receiveShadow
      />
      <lineSegments
        geometry={floorGridGeometry}
        material={gridMaterial}
        position={[0, WAREHOUSE_GROUND_Y + 0.002, 0]}
      />
    </group>
  );
}

/** 仓库顶灯 + 巷道补光，突出货位体积感 */
export function WarehouseLights() {
  return (
    <>
      <ambientLight intensity={0.36} color="#c5d0e4" />
      <hemisphereLight args={["#e8f4ff", "#1a2336", 0.48]} position={[0, 24, 0]} />

      {/* 主光：模拟高位顶灯，投下柔和阴影 */}
      <directionalLight
        position={[10, 20, 8]}
        intensity={2.35}
        color="#fff6eb"
        castShadow
        shadow-mapSize-width={1536}
        shadow-mapSize-height={1536}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-near={4}
        shadow-camera-far={42}
        shadow-bias={-0.0002}
        shadow-normalBias={0.025}
      />

      {/* 冷色填充光，勾出背光面 */}
      <directionalLight position={[-8, 12, -6]} intensity={0.42} color="#93c5fd" />

      {/* 轮廓光，拉开货架层次 */}
      <directionalLight position={[0, 6, -15]} intensity={0.5} color="#5eead4" />
    </>
  );
}
