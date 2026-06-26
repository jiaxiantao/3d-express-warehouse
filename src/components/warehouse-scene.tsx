"use client";

import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import {
  forwardRef,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import {
  actionProgress,
  getActionVisual,
  getSlotMotionState,
  isActionRunning,
  type WarehouseActionPulse,
} from "@/lib/warehouse-animations";
import { getSlotSelectionOutlineColors, FILTER_DIM_OPACITY, SLOT_STATUS_COLORS } from "@/lib/warehouse-colors";
import {
  getAisleWorldZByIndex,
  getBayDividerLocalXs,
  getBayDividerPostLocalXs,
  getBeamCenterY,
  getRackBackLocalZ,
  getRackDepthBeamCenterZ,
  getRackDepthSpan,
  getRackFrontLocalZ,
  getRackHeight,
  getRackOriginX,
  getRackTopBeamLocalY,
  getRackWidth,
  getSlotWorldPosition,
  RACK_BEAM_THICKNESS,
  RACK_POST_THICKNESS,
  SLOT_DEPTH_FIT_RATIO,
  SLOT_FIT_RATIO,
  WAREHOUSE_LAYOUT,
} from "@/lib/warehouse-layout";
import type { SlotStatus, WarehouseSlot, WarehouseViewMode } from "@/lib/warehouse-types";
import {
  WarehouseFloor,
  WarehouseLights,
  WAREHOUSE_GROUND_Y,
} from "@/components/warehouse-environment";
import { WarehouseFence } from "@/components/warehouse-fence";
import { WarehouseRackCategoryLabels } from "@/components/warehouse-rack-category-labels";
import { WarehouseSlotLabels } from "@/components/warehouse-slot-labels";
import { WarehouseRobot } from "@/components/warehouse-robot";
import { WarehouseRobotControls, type RobotViewLookApi } from "@/components/warehouse-robot-controls";
import { WarehouseRobotFloorNav } from "@/components/warehouse-robot-floor-nav";
import type { RobotDriveState } from "@/lib/warehouse-robot-drive";
import type { RobotMoveTarget } from "@/lib/warehouse-robot-navigation";
import { createRobotMotionState } from "@/lib/warehouse-robot-motion";
import { WAREHOUSE_ROBOT } from "@/lib/warehouse-robot-config";
import { createGodViewOrbitState, createThirdPersonOrbitState, getGodViewTarget, type GodViewOrbitState, type ThirdPersonOrbitState } from "@/lib/warehouse-robot-view-state";
import type { WarehouseSceneHandle } from "@/lib/warehouse-scene-types";
import { disposeRackCategoryLabelTextures } from "@/lib/warehouse-rack-category-label";
import { cn } from "@/lib/utils";

export type { WarehouseSceneHandle };

type WarehouseSceneProps = {
  slots: WarehouseSlot[];
  selectedSlotId: string | null;
  highlightedFilter: SlotStatus | "all";
  viewMode: WarehouseViewMode;
  actionPulse: WarehouseActionPulse | null;
  onSelectSlot: (slotId: string | null) => void;
  controlHandleRef?: React.RefObject<WarehouseSceneHandle | null>;
};

const ROBOT_ORBIT_HEIGHT = WAREHOUSE_GROUND_Y + WAREHOUSE_ROBOT.targetHeight * 0.52;

const thirdPersonTargetScratch = new THREE.Vector3();
const thirdPersonPositionScratch = new THREE.Vector3();
const godViewTargetScratch = new THREE.Vector3();
const godViewPositionScratch = new THREE.Vector3();

function getRobotOrbitTarget(out = new THREE.Vector3(), pivot?: THREE.Group | null) {
  if (pivot) {
    out.set(pivot.position.x, ROBOT_ORBIT_HEIGHT, pivot.position.z);
  } else {
    out.set(WAREHOUSE_ROBOT.spawn.x, ROBOT_ORBIT_HEIGHT, WAREHOUSE_ROBOT.spawn.z);
  }
  return out;
}

/** 第三人称：球面轨道绕机器人，相机始终看向机器人 */
function applyThirdPersonCamera(
  camera: THREE.Camera,
  pivot?: THREE.Group | null,
  orbit: ThirdPersonOrbitState = {
    yawOffset: 0,
    pitch: WAREHOUSE_ROBOT.thirdPerson.defaultPitch,
    distance: WAREHOUSE_ROBOT.thirdPerson.distance,
  },
) {
  const bodyYaw = pivot ? pivot.rotation.y : WAREHOUSE_ROBOT.spawn.yaw;
  const target = getRobotOrbitTarget(thirdPersonTargetScratch, pivot);
  const chaseYaw = bodyYaw + orbit.yawOffset;
  const horizontal = orbit.distance * Math.cos(orbit.pitch);

  thirdPersonPositionScratch.set(
    target.x - Math.sin(chaseYaw) * horizontal,
    target.y + WAREHOUSE_ROBOT.thirdPerson.height + orbit.distance * Math.sin(orbit.pitch),
    target.z - Math.cos(chaseYaw) * horizontal,
  );

  camera.position.copy(thirdPersonPositionScratch);
  camera.lookAt(target);
}

/** 上帝视角：绕仓库中心球面轨道，可自由拖拽 */
function applyGodViewCamera(
  camera: THREE.Camera,
  orbit: GodViewOrbitState = createGodViewOrbitState(),
) {
  const target = getGodViewTarget(godViewTargetScratch);
  const horizontal = orbit.distance * Math.cos(orbit.pitch);

  godViewPositionScratch.set(
    target.x - Math.sin(orbit.yaw) * horizontal,
    target.y + orbit.distance * Math.sin(orbit.pitch),
    target.z - Math.cos(orbit.yaw) * horizontal,
  );

  camera.position.copy(godViewPositionScratch);
  camera.lookAt(target);
}

function getDefaultGodViewCameraPosition(): [number, number, number] {
  const target = getGodViewTarget(godViewTargetScratch);
  const { distance, defaultPitch, defaultYaw } = WAREHOUSE_ROBOT.godView;
  const horizontal = distance * Math.cos(defaultPitch);
  return [
    target.x - Math.sin(defaultYaw) * horizontal,
    target.y + distance * Math.sin(defaultPitch),
    target.z - Math.cos(defaultYaw) * horizontal,
  ];
}

function getDefaultThirdPersonCameraPosition(): [number, number, number] {
  const target = getRobotOrbitTarget(thirdPersonTargetScratch);
  const { distance, height, defaultPitch } = WAREHOUSE_ROBOT.thirdPerson;
  const bodyYaw = WAREHOUSE_ROBOT.spawn.yaw;
  const horizontal = distance * Math.cos(defaultPitch);
  return [
    target.x - Math.sin(bodyYaw) * horizontal,
    target.y + height + distance * Math.sin(defaultPitch),
    target.z - Math.cos(bodyYaw) * horizontal,
  ];
}

/** 稳定引用：Canvas 每次父组件重渲染都会 re-configure，内联对象会重置相机/阴影 */
const WAREHOUSE_CANVAS_GL = {
  antialias: true,
  alpha: false,
  powerPreference: "default" as const,
  preserveDrawingBuffer: true,
};

const GOD_VIEW_CAMERA = {
  position: getDefaultGodViewCameraPosition(),
  fov: 48,
  near: 0.1,
  far: 120,
} as const;

const THIRD_PERSON_VIEW_CAMERA = {
  position: getDefaultThirdPersonCameraPosition(),
  fov: 45,
  near: 0.1,
  far: 80,
} as const;

const ROBOT_VIEW_CAMERA = {
  position: [WAREHOUSE_ROBOT.spawn.x, WAREHOUSE_ROBOT.targetHeight * 0.95, WAREHOUSE_ROBOT.spawn.z] as [
    number,
    number,
    number,
  ],
  fov: 58,
  near: 0.1,
  far: 80,
} as const;

const sharedSlotGeometry = new THREE.BoxGeometry(
  WAREHOUSE_LAYOUT.slotWidth,
  WAREHOUSE_LAYOUT.slotHeight,
  WAREHOUSE_LAYOUT.slotDepth,
);

const SLOT_STATUSES: SlotStatus[] = [
  "empty",
  "occupied",
  "low",
  "full",
  "warning",
  "reserved",
  "locked",
];

function createStatusSlotMaterials(): Record<SlotStatus, THREE.MeshStandardMaterial> {
  return Object.fromEntries(
    SLOT_STATUSES.map((status) => [
      status,
      new THREE.MeshStandardMaterial({
        color: SLOT_STATUS_COLORS[status],
        roughness: 0.56,
        metalness: 0.06,
      }),
    ]),
  ) as Record<SlotStatus, THREE.MeshStandardMaterial>;
}

const rackPostMaterial = new THREE.MeshStandardMaterial({
  color: "#9aa8bc",
  roughness: 0.42,
  metalness: 0.58,
});
const rackBeamMaterial = new THREE.MeshStandardMaterial({
  color: "#d0dae8",
  roughness: 0.36,
  metalness: 0.64,
});

const floorPickGeometry = new THREE.PlaneGeometry(80, 80);

/** 状态筛选时，非匹配货位半透明压暗（独立 mesh 绘制，避免 InstancedMesh 透明缺面） */
const FILTER_DIM_TARGET = new THREE.Color("#0b1220");
const FILTER_DIM_COLOR_LERP = 0.18;
const FILTER_EMPHASIS_TINT = new THREE.Color("#ffffff");
const FILTER_EMPHASIS_LERP = 0.14;

/** 描边外扩量（世界坐标），使线框贴在货位外侧而不压住箱体 */
const OUTLINE_OUTSET = 0.045;

function getSlotBoxScale(): [number, number, number] {
  return [
    WAREHOUSE_LAYOUT.slotWidth * SLOT_FIT_RATIO,
    WAREHOUSE_LAYOUT.slotHeight * SLOT_FIT_RATIO,
    WAREHOUSE_LAYOUT.slotDepth * SLOT_FIT_RATIO * SLOT_DEPTH_FIT_RATIO,
  ];
}

function getOutlineBoxScale(): [number, number, number] {
  const [sx, sy, sz] = getSlotBoxScale();
  const pad = OUTLINE_OUTSET * 2;
  return [sx + pad, sy + pad, sz + pad];
}

function applyStatusMaterialColor(
  material: THREE.MeshStandardMaterial,
  status: SlotStatus,
  dimmed: boolean,
  emphasized: boolean,
) {
  material.color.set(SLOT_STATUS_COLORS[status]);
  if (dimmed) {
    material.color.lerp(FILTER_DIM_TARGET, FILTER_DIM_COLOR_LERP);
    material.opacity = FILTER_DIM_OPACITY;
    material.transparent = true;
    material.depthWrite = false;
    material.roughness = 0.78;
    material.metalness = 0.02;
    material.emissive.set("#000000");
  } else if (emphasized) {
    material.color.lerp(FILTER_EMPHASIS_TINT, FILTER_EMPHASIS_LERP);
    material.opacity = 1;
    material.transparent = false;
    material.depthWrite = true;
    material.roughness = 0.42;
    material.metalness = 0.08;
    material.emissive.copy(material.color).multiplyScalar(0.06);
  } else {
    material.opacity = 1;
    material.transparent = false;
    material.depthWrite = true;
    material.roughness = 0.56;
    material.metalness = 0.06;
    material.emissive.set("#000000");
  }
  material.depthTest = true;
}

type SlotActionRef = {
  localIndex: number;
  startedAt: number;
  action: WarehouseActionPulse["action"];
} | null;

function getSlotInstanceTransform(
  slot: WarehouseSlot,
  slotIndex: number,
  hoveredIndex: number | null,
  localIndex: number,
  actionRef: SlotActionRef,
  now: number,
) {
  const [x, y, z] = getSlotWorldPosition(slot);
  const actionState =
    actionRef?.localIndex === localIndex
      ? { slotId: slot.id, action: actionRef.action, startedAt: actionRef.startedAt }
      : null;
  const motion = getSlotMotionState(slotIndex, slot.id, hoveredIndex, actionState, now);

  return {
    x: x + motion.shakeX,
    y: y + motion.yLift,
    z,
    sx: SLOT_FIT_RATIO * motion.interact * motion.scaleMul,
    sy: SLOT_FIT_RATIO * motion.interact * motion.scaleMul,
    sz: SLOT_FIT_RATIO * SLOT_DEPTH_FIT_RATIO * motion.interact * motion.scaleMul,
  };
}

function disposeSceneResources(scene: THREE.Scene, gl: THREE.WebGLRenderer) {
  const sharedMaterials = new Set<THREE.Material>([rackPostMaterial, rackBeamMaterial]);
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }
    const mesh = object;
    if (
      mesh.geometry &&
      mesh.geometry !== sharedSlotGeometry &&
      mesh.geometry !== floorPickGeometry
    ) {
      mesh.geometry.dispose();
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (material && !sharedMaterials.has(material)) {
        material.dispose();
      }
    }
  });
  disposeRackCategoryLabelTextures();
  gl.dispose();
  gl.forceContextLoss();
}

function WebGLCleanup() {
  const { gl, scene } = useThree();
  useEffect(() => () => disposeSceneResources(scene, gl), [gl, scene]);
  return null;
}

/** demand 模式下首屏多帧刷新，避免货位矩阵/颜色未写入 */
function DemandRenderBoot() {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    let frames = 0;
    const tick = () => {
      invalidate();
      frames += 1;
      if (frames < 24) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }, [invalidate]);
  return null;
}

/** 选中描边：细线 + 慢速流动虚线 */
const OUTLINE_FLOW_SPEED = 0.34;
const OUTLINE_BASE_WIDTH = 0.018;
const OUTLINE_FLOW_WIDTH = 0.024;
const OUTLINE_GLOW_WIDTH = 0.03;
const OUTLINE_FLOW_DASH_SIZE = 0.08;
const OUTLINE_FLOW_GAP_SIZE = 0.036;

function createSelectedOutlineLines(colors: { base: number; flow: number; glow: number }) {
  const lineGeometry = new LineSegmentsGeometry();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const edges = new THREE.EdgesGeometry(box, 15);
  lineGeometry.fromEdgesGeometry(edges);
  box.dispose();
  edges.dispose();

  const baseMaterial = new LineMaterial({
    color: colors.base,
    linewidth: OUTLINE_BASE_WIDTH,
    worldUnits: true,
    transparent: true,
    opacity: 0.88,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });

  const flowMaterial = new LineMaterial({
    color: colors.flow,
    linewidth: OUTLINE_FLOW_WIDTH,
    worldUnits: true,
    dashed: true,
    dashSize: OUTLINE_FLOW_DASH_SIZE,
    gapSize: OUTLINE_FLOW_GAP_SIZE,
    dashScale: 1,
    transparent: true,
    opacity: 1,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });

  const glowMaterial = new LineMaterial({
    color: colors.glow,
    linewidth: OUTLINE_GLOW_WIDTH,
    worldUnits: true,
    transparent: true,
    opacity: 0.24,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });

  const baseLine = new LineSegments2(lineGeometry, baseMaterial);
  const flowLine = new LineSegments2(lineGeometry, flowMaterial);
  const glowLine = new LineSegments2(lineGeometry, glowMaterial);
  baseLine.computeLineDistances();
  flowLine.computeLineDistances();
  baseLine.renderOrder = 9;
  glowLine.renderOrder = 8;
  flowLine.renderOrder = 10;

  return { lineGeometry, baseLine, flowLine, glowLine };
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function SelectedSlotOutline({
  slot,
  actionPulse,
}: {
  slot: WarehouseSlot;
  actionPulse: WarehouseActionPulse | null;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const invalidate = useThree((state) => state.invalidate);
  const reducedMotion = usePrefersReducedMotion();
  const actionStartedAt = useRef<number | null>(null);
  const actionType = useRef<WarehouseActionPulse["action"] | null>(null);

  const outlinePalette = useMemo(() => getSlotSelectionOutlineColors(slot.status), [slot.status]);
  const outlineFlowRef = useRef<LineMaterial | null>(null);
  const outlineLines = useMemo(() => {
    const colors = {
      base: new THREE.Color(outlinePalette.base).getHex(),
      flow: new THREE.Color(outlinePalette.flow).getHex(),
      glow: new THREE.Color(outlinePalette.glow).getHex(),
    };
    return createSelectedOutlineLines(colors);
  }, [outlinePalette]);
  const { lineGeometry, baseLine, flowLine, glowLine } = outlineLines;
  const size = useThree((state) => state.size);
  const viewportDpr = useThree((state) => state.viewport.dpr);

  useLayoutEffect(() => {
    outlineFlowRef.current = flowLine.material as LineMaterial;
  }, [flowLine]);

  useLayoutEffect(() => {
    const resolution = new THREE.Vector2(size.width * viewportDpr, size.height * viewportDpr);
    for (const line of [baseLine, flowLine, glowLine]) {
      (line.material as LineMaterial).resolution.copy(resolution);
    }
    invalidate();
  }, [baseLine, flowLine, glowLine, invalidate, size.height, size.width, viewportDpr]);

  const [boxSx, boxSy, boxSz] = useMemo(() => getOutlineBoxScale(), []);

  useLayoutEffect(() => {
    invalidate();
  }, [invalidate, slot.id]);

  useEffect(() => {
    if (!actionPulse || actionPulse.slotId !== slot.id) {
      return;
    }
    actionStartedAt.current = performance.now();
    actionType.current = actionPulse.action;
    invalidate();
  }, [actionPulse, invalidate, slot.id]);

  useEffect(
    () => () => {
      lineGeometry.dispose();
      baseLine.material.dispose();
      flowLine.material.dispose();
      glowLine.material.dispose();
    },
    [baseLine, flowLine, glowLine, lineGeometry],
  );

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    const flowMaterial = outlineFlowRef.current;
    if (!reducedMotion && flowMaterial) {
      flowMaterial.dashOffset = -state.clock.elapsedTime * OUTLINE_FLOW_SPEED;
    }

    const [x, y, z] = getSlotWorldPosition(slot);
    let shakeX = 0;
    let yLift = 0;
    let scaleMul = 1;

    if (actionStartedAt.current && actionType.current) {
      const now = performance.now();
      if (isActionRunning(actionStartedAt.current, now)) {
        const visual = getActionVisual(actionType.current, actionProgress(actionStartedAt.current, now));
        shakeX = visual.shakeX;
        yLift = visual.yLift;
        scaleMul = visual.scaleMul;
      } else {
        actionStartedAt.current = null;
        actionType.current = null;
      }
    }

    group.position.set(x + shakeX, y + yLift, z);
    group.scale.set(boxSx * scaleMul, boxSy * scaleMul, boxSz * scaleMul);

    // demand 模式：流动描边需每帧 invalidate，节流会导致动画卡顿
    if (!reducedMotion || actionStartedAt.current) {
      invalidate();
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={glowLine} />
      <primitive object={baseLine} />
      <primitive object={flowLine} />
    </group>
  );
}

type AnimatedSlotsProps = {
  slots: WarehouseSlot[];
  selectedSlotId: string | null;
  highlightedFilter: SlotStatus | "all";
  actionPulse: WarehouseActionPulse | null;
  onSelectSlot: (slotId: string | null) => void;
};

type GroupedSlot = { slot: WarehouseSlot; slotIndex: number };

function groupSlotsByStatus(slots: WarehouseSlot[]): Record<SlotStatus, GroupedSlot[]> {
  const groups: Record<SlotStatus, GroupedSlot[]> = {
    empty: [],
    occupied: [],
    low: [],
    full: [],
    warning: [],
    reserved: [],
    locked: [],
  };
  slots.forEach((slot, slotIndex) => {
    groups[slot.status].push({ slot, slotIndex });
  });
  return groups;
}

type StatusSlotBatchProps = {
  status: SlotStatus;
  entries: GroupedSlot[];
  material: THREE.MeshStandardMaterial;
  highlightedFilter: SlotStatus | "all";
  hoveredIndex: number | null;
  actionPulse: WarehouseActionPulse | null;
  onSelectSlot: (slotId: string | null) => void;
  onHover: (slotIndex: number | null) => void;
};

/** 筛选态下未匹配货位：独立 mesh + 半透明，保证各面混合一致 */
function DimmedTransparentSlotBatch({
  status,
  entries,
  material,
  hoveredIndex,
  actionPulse,
  onSelectSlot,
  onHover,
}: StatusSlotBatchProps) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const invalidate = useThree((state) => state.invalidate);
  const actionRef = useRef<SlotActionRef>(null);
  const bootFrames = useRef(12);

  useLayoutEffect(() => {
    applyStatusMaterialColor(material, status, true, false);
    invalidate();
  }, [invalidate, material, status]);

  useEffect(() => {
    if (!actionPulse) {
      return;
    }
    const localIndex = entries.findIndex((entry) => entry.slot.id === actionPulse.slotId);
    if (localIndex < 0) {
      return;
    }
    actionRef.current = {
      localIndex,
      startedAt: performance.now(),
      action: actionPulse.action,
    };
    invalidate();
  }, [actionPulse, entries, invalidate]);

  useEffect(() => {
    bootFrames.current = 12;
    invalidate();
  }, [hoveredIndex, invalidate, entries.length]);

  useFrame(() => {
    const now = performance.now();
    let animating = false;

    if (actionRef.current) {
      if (!isActionRunning(actionRef.current.startedAt, now)) {
        actionRef.current = null;
      } else {
        animating = true;
      }
    }

    if (!animating && bootFrames.current <= 0) {
      return;
    }

    entries.forEach(({ slot, slotIndex }, localIndex) => {
      const mesh = meshRefs.current[localIndex];
      if (!mesh) {
        return;
      }
      const transform = getSlotInstanceTransform(
        slot,
        slotIndex,
        hoveredIndex,
        localIndex,
        actionRef.current,
        now,
      );
      mesh.position.set(transform.x, transform.y, transform.z);
      mesh.scale.set(transform.sx, transform.sy, transform.sz);
    });

    if (bootFrames.current > 0) {
      bootFrames.current -= 1;
    }
    invalidate();
  });

  const handlePointerOut = useCallback(() => {
    onHover(null);
    document.body.style.cursor = "auto";
  }, [onHover]);

  if (entries.length === 0) {
    return null;
  }

  return (
    <>
      {entries.map(({ slot, slotIndex }, localIndex) => (
        <mesh
          key={slot.id}
          ref={(node) => {
            meshRefs.current[localIndex] = node;
          }}
          geometry={sharedSlotGeometry}
          material={material}
          renderOrder={1}
          castShadow={false}
          onClick={(event) => {
            event.stopPropagation();
            onSelectSlot(slot.id);
            invalidate();
          }}
          onPointerOver={(event) => {
            event.stopPropagation();
            onHover(slotIndex);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={handlePointerOut}
        />
      ))}
    </>
  );
}

function InstancedStatusSlotBatch({
  status,
  entries,
  material,
  highlightedFilter,
  hoveredIndex,
  actionPulse,
  onSelectSlot,
  onHover,
}: StatusSlotBatchProps) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const [meshReady, setMeshReady] = useState(false);
  const tempObject = useMemo(() => new THREE.Object3D(), []);
  const invalidate = useThree((state) => state.invalidate);
  const dimmed = highlightedFilter !== "all" && highlightedFilter !== status;
  const emphasized = highlightedFilter !== "all" && !dimmed;
  const slotRenderOrder = highlightedFilter !== "all" ? (dimmed ? 1 : 4) : 3;
  const actionRef = useRef<SlotActionRef>(null);
  const bootFrames = useRef(12);

  useEffect(() => {
    if (!actionPulse) {
      return;
    }
    const localIndex = entries.findIndex((entry) => entry.slot.id === actionPulse.slotId);
    if (localIndex < 0) {
      return;
    }
    actionRef.current = {
      localIndex,
      startedAt: performance.now(),
      action: actionPulse.action,
    };
    invalidate();
  }, [actionPulse, entries, invalidate]);

  const paintInstances = useCallback(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    const now = performance.now();
    entries.forEach(({ slot, slotIndex }, localIndex) => {
      const transform = getSlotInstanceTransform(
        slot,
        slotIndex,
        hoveredIndex,
        localIndex,
        actionRef.current,
        now,
      );

      tempObject.position.set(transform.x, transform.y, transform.z);
      tempObject.scale.set(transform.sx, transform.sy, transform.sz);
      tempObject.updateMatrix();
      mesh.setMatrixAt(localIndex, tempObject.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  }, [entries, hoveredIndex, tempObject]);

  useLayoutEffect(() => {
    if (!meshReady) {
      return;
    }
    applyStatusMaterialColor(material, status, dimmed, emphasized);
    paintInstances();
    invalidate();
  }, [dimmed, emphasized, invalidate, material, meshReady, paintInstances, status]);

  useEffect(() => {
    bootFrames.current = 12;
    if (meshReady) {
      paintInstances();
      invalidate();
    }
  }, [hoveredIndex, invalidate, meshReady, paintInstances, entries.length]);

  const bindMeshRef = useCallback((node: THREE.InstancedMesh | null) => {
    meshRef.current = node;
    setMeshReady(node !== null);
  }, []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    const now = performance.now();
    let animating = false;

    if (actionRef.current) {
      if (!isActionRunning(actionRef.current.startedAt, now)) {
        actionRef.current = null;
      } else {
        animating = true;
      }
    }

    if (!animating && bootFrames.current <= 0) {
      return;
    }

    paintInstances();

    if (bootFrames.current > 0) {
      bootFrames.current -= 1;
    }
    invalidate();
  });

  const handlePointerOver = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      const localIndex = event.instanceId;
      if (localIndex !== undefined) {
        onHover(entries[localIndex]?.slotIndex ?? null);
      }
      document.body.style.cursor = "pointer";
    },
    [entries, onHover],
  );

  const handlePointerOut = useCallback(() => {
    onHover(null);
    document.body.style.cursor = "auto";
  }, [onHover]);

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      const localIndex = event.instanceId;
      if (localIndex === undefined) {
        return;
      }
      onSelectSlot(entries[localIndex]?.slot.id ?? null);
      invalidate();
    },
    [entries, invalidate, onSelectSlot],
  );

  if (entries.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      ref={bindMeshRef}
      args={[sharedSlotGeometry, material, entries.length]}
      renderOrder={slotRenderOrder}
      castShadow
      receiveShadow
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    />
  );
}

function AnimatedInstancedSlots({
  slots,
  selectedSlotId,
  highlightedFilter,
  actionPulse,
  onSelectSlot,
}: AnimatedSlotsProps) {
  const statusMaterials = useMemo(() => createStatusSlotMaterials(), []);
  const grouped = useMemo(() => groupSlotsByStatus(slots), [slots]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(
    () => () => {
      Object.values(statusMaterials).forEach((material) => material.dispose());
    },
    [statusMaterials],
  );

  const selectedIndex = useMemo(
    () => (selectedSlotId ? slots.findIndex((slot) => slot.id === selectedSlotId) : -1),
    [selectedSlotId, slots],
  );

  const handleHover = useCallback((slotIndex: number | null) => {
    setHoveredIndex((prev) => (prev === slotIndex ? prev : slotIndex));
  }, []);

  return (
    <>
      {SLOT_STATUSES.map((status) => {
        const batchProps = {
          status,
          material: statusMaterials[status],
          entries: grouped[status],
          highlightedFilter,
          hoveredIndex,
          actionPulse,
          onSelectSlot,
          onHover: handleHover,
        };
        const dimmed = highlightedFilter !== "all" && highlightedFilter !== status;

        if (dimmed) {
          return <DimmedTransparentSlotBatch key={status} {...batchProps} />;
        }

        return <InstancedStatusSlotBatch key={status} {...batchProps} />;
      })}
      {selectedIndex >= 0 ? (
        <SelectedSlotOutline slot={slots[selectedIndex]} actionPulse={actionPulse} />
      ) : null}
      <WarehouseSlotLabels
        slots={slots}
        highlightedFilter={highlightedFilter}
        hoveredIndex={hoveredIndex}
        actionPulse={actionPulse}
      />
    </>
  );
}

function RackFrames() {
  const postGeometry = useMemo(() => new THREE.BoxGeometry(RACK_POST_THICKNESS, 1, RACK_POST_THICKNESS), []);
  const beamSpan = getRackWidth() - RACK_POST_THICKNESS;
  const depthSpan = getRackDepthSpan();
  const xBeamGeometry = useMemo(
    () => new THREE.BoxGeometry(beamSpan, RACK_BEAM_THICKNESS, RACK_POST_THICKNESS),
    [beamSpan],
  );
  const zBeamGeometry = useMemo(
    () => new THREE.BoxGeometry(RACK_POST_THICKNESS, RACK_BEAM_THICKNESS, depthSpan),
    [depthSpan],
  );
  const rackWidth = getRackWidth();
  const rackHeight = getRackHeight();
  const originX = getRackOriginX();
  const beamCenterX = RACK_POST_THICKNESS + beamSpan / 2;
  const leftPostX = RACK_POST_THICKNESS / 2;
  const rightPostX = rackWidth - RACK_POST_THICKNESS / 2;
  const bayDividerXs = useMemo(() => getBayDividerLocalXs(), []);
  const bayDividerPostXs = useMemo(() => getBayDividerPostLocalXs(), []);
  const topBeamY = getRackTopBeamLocalY();

  useEffect(() => {
    return () => {
      postGeometry.dispose();
      xBeamGeometry.dispose();
      zBeamGeometry.dispose();
    };
  }, [postGeometry, xBeamGeometry, zBeamGeometry]);

  return (
    <>
      {WAREHOUSE_LAYOUT.aisles.map((aisle, aisleIndex) => {
        const aisleZ = getAisleWorldZByIndex(aisleIndex);

        return (
          <group key={aisle} position={[originX, WAREHOUSE_GROUND_Y, aisleZ]}>
            {(["left", "right"] as const).map((side) => {
              const frontZ = getRackFrontLocalZ(side);
              const backZ = getRackBackLocalZ(side);
              const depthBeamZ = getRackDepthBeamCenterZ(side);
              const cornerPosts: Array<[number, number]> = [
                [leftPostX, backZ],
                [rightPostX, backZ],
                [leftPostX, frontZ],
                [rightPostX, frontZ],
              ];

              const renderBeamFrame = (beamY: number, keyPrefix: string, includeBayDividers = true) => (
                <group key={keyPrefix}>
                  <mesh
                    position={[beamCenterX, beamY, frontZ]}
                    geometry={xBeamGeometry}
                    material={rackBeamMaterial}
                    castShadow
                    receiveShadow
                    renderOrder={1}
                  />
                  <mesh
                    position={[beamCenterX, beamY, backZ]}
                    geometry={xBeamGeometry}
                    material={rackBeamMaterial}
                    castShadow
                    receiveShadow
                    renderOrder={1}
                  />
                  <mesh
                    position={[leftPostX, beamY, depthBeamZ]}
                    geometry={zBeamGeometry}
                    material={rackBeamMaterial}
                    castShadow
                    receiveShadow
                    renderOrder={1}
                  />
                  <mesh
                    position={[rightPostX, beamY, depthBeamZ]}
                    geometry={zBeamGeometry}
                    material={rackBeamMaterial}
                    castShadow
                    receiveShadow
                    renderOrder={1}
                  />
                  {includeBayDividers
                    ? bayDividerXs.map((dividerX) => (
                        <mesh
                          key={`${keyPrefix}-divider-${dividerX}`}
                          position={[dividerX, beamY, depthBeamZ]}
                          geometry={zBeamGeometry}
                          material={rackBeamMaterial}
                          renderOrder={1}
                        />
                      ))
                    : null}
                </group>
              );

              return (
                <group key={side}>
                  {cornerPosts.map(([x, z], cornerIndex) => (
                    <mesh
                      key={`post-${cornerIndex}`}
                      position={[x, rackHeight / 2, z]}
                      scale={[1, rackHeight, 1]}
                      geometry={postGeometry}
                      material={rackPostMaterial}
                      castShadow
                      receiveShadow
                      renderOrder={1}
                    />
                  ))}
                  {bayDividerPostXs.flatMap((dividerX) => [
                    <mesh
                      key={`mid-post-front-${dividerX}`}
                      position={[dividerX, rackHeight / 2, frontZ]}
                      scale={[1, rackHeight, 1]}
                      geometry={postGeometry}
                      material={rackPostMaterial}
                      castShadow
                      receiveShadow
                      renderOrder={1}
                    />,
                    <mesh
                      key={`mid-post-back-${dividerX}`}
                      position={[dividerX, rackHeight / 2, backZ]}
                      scale={[1, rackHeight, 1]}
                      geometry={postGeometry}
                      material={rackPostMaterial}
                      castShadow
                      receiveShadow
                      renderOrder={1}
                    />,
                  ])}
                  {Array.from({ length: WAREHOUSE_LAYOUT.levelsPerBay }, (_, levelIndex) =>
                    renderBeamFrame(
                      getBeamCenterY(levelIndex + 1) - WAREHOUSE_GROUND_Y,
                      `level-${levelIndex}`,
                    ),
                  )}
                  {renderBeamFrame(topBeamY, "top-cap", false)}
                </group>
              );
            })}
          </group>
        );
      })}
    </>
  );
}

function pivotHasRobotModel(pivot: THREE.Group | null) {
  if (!pivot) {
    return false;
  }
  let found = false;
  pivot.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh) {
      found = true;
    }
  });
  return found;
}

/** Suspense 内机器人挂载后通知外层关闭 loading */
function RobotReadyNotifier({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

function ChaseThirdPersonCamera({
  robotPivotRef,
  orbitStateRef,
  blockGroundClickRef,
}: {
  robotPivotRef: React.RefObject<THREE.Group | null>;
  orbitStateRef: React.RefObject<ThirdPersonOrbitState>;
  blockGroundClickRef: React.RefObject<boolean>;
}) {
  const { camera, gl, invalidate } = useThree();
  const pendingBootstrap = useRef(true);
  const pointerHeld = useRef(false);
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  const applyChaseCamera = useCallback(() => {
    const orbit = orbitStateRef.current;
    if (!orbit) {
      return;
    }
    applyThirdPersonCamera(camera, robotPivotRef.current, orbit);
  }, [camera, orbitStateRef, robotPivotRef]);

  useEffect(() => {
    pendingBootstrap.current = true;
    applyChaseCamera();
    invalidate();
  }, [applyChaseCamera, invalidate]);

  useEffect(() => {
    const canvas = gl.domElement;
    const { orbitYawSensitivity } = WAREHOUSE_ROBOT.thirdPerson;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      pointerHeld.current = true;
      dragging.current = false;
      lastPointer.current = { x: event.clientX, y: event.clientY };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pointerHeld.current) {
        return;
      }

      const deltaX = event.clientX - lastPointer.current.x;
      if (!dragging.current && Math.abs(deltaX) < 4) {
        return;
      }

      if (!dragging.current) {
        dragging.current = true;
        canvas.setPointerCapture(event.pointerId);
      }

      lastPointer.current = { x: event.clientX, y: event.clientY };
      // 转动机器人朝向本身，相机跟随机身追尾，即「以机器人视角旋转」
      const pivot = robotPivotRef.current;
      if (!pivot) {
        return;
      }
      pivot.rotation.y -= deltaX * orbitYawSensitivity;
      applyChaseCamera();
      invalidate();
    };

    const endPointer = (event: PointerEvent) => {
      if (!pointerHeld.current) {
        return;
      }
      const wasDragging = dragging.current;
      pointerHeld.current = false;
      dragging.current = false;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      if (wasDragging) {
        blockGroundClickRef.current = true;
        requestAnimationFrame(() => {
          blockGroundClickRef.current = false;
        });
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);

    return () => {
      pointerHeld.current = false;
      dragging.current = false;
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endPointer);
      canvas.removeEventListener("pointercancel", endPointer);
    };
  }, [applyChaseCamera, blockGroundClickRef, gl.domElement, invalidate, robotPivotRef]);

  useFrame(() => {
    if (pendingBootstrap.current) {
      if (pivotHasRobotModel(robotPivotRef.current)) {
        applyChaseCamera();
        pendingBootstrap.current = false;
        invalidate();
      }
      return;
    }

    applyChaseCamera();
    invalidate();
  });

  return null;
}

function GodViewControls({
  blockGroundClickRef,
  orbitStateRef,
}: {
  blockGroundClickRef: React.RefObject<boolean>;
  orbitStateRef: React.RefObject<GodViewOrbitState>;
}) {
  const { camera, gl, invalidate } = useThree();
  const pointerHeld = useRef(false);
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  const applyOrbitCamera = useCallback(() => {
    const orbit = orbitStateRef.current;
    if (!orbit) {
      return;
    }
    applyGodViewCamera(camera, orbit);
  }, [camera, orbitStateRef]);

  useEffect(() => {
    const canvas = gl.domElement;
    const {
      minDistance,
      maxDistance,
      orbitYawSensitivity,
      orbitPitchSensitivity,
      minPitch,
      maxPitch,
    } = WAREHOUSE_ROBOT.godView;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const orbit = orbitStateRef.current;
      if (!orbit) {
        return;
      }
      orbit.distance = THREE.MathUtils.clamp(
        orbit.distance + event.deltaY * 0.012,
        minDistance,
        maxDistance,
      );
      applyOrbitCamera();
      invalidate();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      pointerHeld.current = true;
      dragging.current = false;
      lastPointer.current = { x: event.clientX, y: event.clientY };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pointerHeld.current) {
        return;
      }
      const deltaX = event.clientX - lastPointer.current.x;
      const deltaY = event.clientY - lastPointer.current.y;
      if (!dragging.current && Math.hypot(deltaX, deltaY) < 4) {
        return;
      }
      dragging.current = true;
      canvas.setPointerCapture(event.pointerId);
      lastPointer.current = { x: event.clientX, y: event.clientY };
      const orbit = orbitStateRef.current;
      if (!orbit) {
        return;
      }
      orbit.yaw = orbit.yaw - deltaX * orbitYawSensitivity;
      orbit.pitch = THREE.MathUtils.clamp(
        orbit.pitch - deltaY * orbitPitchSensitivity,
        minPitch,
        maxPitch,
      );
      applyOrbitCamera();
      invalidate();
    };

    const endPointer = (event: PointerEvent) => {
      if (!pointerHeld.current) {
        return;
      }
      const wasDragging = dragging.current;
      pointerHeld.current = false;
      dragging.current = false;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      // 拖拽松手时忽略同一次 pointerup 触发的地面 click，下一帧恢复
      if (wasDragging) {
        blockGroundClickRef.current = true;
        requestAnimationFrame(() => {
          blockGroundClickRef.current = false;
        });
      }
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);

    applyOrbitCamera();
    invalidate();

    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endPointer);
      canvas.removeEventListener("pointercancel", endPointer);
    };
  }, [applyOrbitCamera, blockGroundClickRef, gl.domElement, invalidate, orbitStateRef]);

  // 机器人在上帝视角下也能被驾驶移动，镜头绕仓库中心固定，无需每帧跟随
  return null;
}

function WarehouseRobotRig({
  viewMode,
  onGroundClick,
  onRobotReady,
  pivotRef,
  driveStateRef,
  thirdPersonOrbitRef,
  godOrbitRef,
  viewLookApiRef,
}: {
  viewMode: WarehouseViewMode;
  onGroundClick?: () => void;
  onRobotReady?: () => void;
  pivotRef: React.RefObject<THREE.Group | null>;
  driveStateRef: React.RefObject<RobotDriveState | null>;
  thirdPersonOrbitRef: React.RefObject<ThirdPersonOrbitState>;
  godOrbitRef: React.RefObject<GodViewOrbitState>;
  viewLookApiRef: React.MutableRefObject<RobotViewLookApi>;
}) {
  const headRef = useRef<THREE.Object3D>(null);
  const movePathRef = useRef<RobotMoveTarget[] | null>(null);
  const motionRef = useRef(createRobotMotionState());
  const blockGroundClickRef = useRef(false);
  const robotView = viewMode === "robot";
  const thirdPersonView = viewMode === "third";
  const godView = viewMode === "god";

  return (
    <>
      <Suspense fallback={null}>
        <WarehouseRobot
          pivotRef={pivotRef}
          headRef={headRef}
          motionRef={motionRef}
          modelVisible={!robotView}
        />
        {onRobotReady ? <RobotReadyNotifier onReady={onRobotReady} /> : null}
      </Suspense>
      <WarehouseRobotFloorNav
        pivotRef={pivotRef}
        movePathRef={movePathRef}
        blockGroundClickRef={blockGroundClickRef}
        onGroundClick={onGroundClick}
      />
      <WarehouseRobotControls
        pivotRef={pivotRef}
        headRef={headRef}
        movePathRef={movePathRef}
        motionRef={motionRef}
        driveStateRef={driveStateRef}
        viewLookApiRef={viewLookApiRef}
        blockGroundClickRef={blockGroundClickRef}
        robotView={robotView}
      />
      {thirdPersonView ? (
        <ChaseThirdPersonCamera
          robotPivotRef={pivotRef}
          orbitStateRef={thirdPersonOrbitRef}
          blockGroundClickRef={blockGroundClickRef}
        />
      ) : null}
      {godView ? (
        <GodViewControls blockGroundClickRef={blockGroundClickRef} orbitStateRef={godOrbitRef} />
      ) : null}
    </>
  );
}

function SceneContent({
  slots,
  selectedSlotId,
  highlightedFilter,
  viewMode,
  actionPulse,
  onSelectSlot,
  onRobotReady,
  controlHandleRef,
  containerRef,
}: Omit<WarehouseSceneProps, "controlHandleRef"> & {
  onRobotReady?: () => void;
  controlHandleRef?: React.RefObject<WarehouseSceneHandle | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const robotPivotRef = useRef<THREE.Group>(null);
  const driveStateRef = useRef<RobotDriveState | null>(null);
  const thirdPersonOrbitRef = useRef<ThirdPersonOrbitState>(createThirdPersonOrbitState());
  const godOrbitRef = useRef<GodViewOrbitState>(createGodViewOrbitState());
  const viewLookApiRef = useRef<RobotViewLookApi>({ rotateByDelta: () => {} });

  return (
    <>
      <color attach="background" args={["#1a2336"]} />
      <fog attach="fog" args={["#1a2336", 28, 55]} />
      <WarehouseLights />
      <WarehouseFloor />
      <WarehouseFence />
      <RackFrames />
      <WarehouseRackCategoryLabels />
      <DemandRenderBoot />
      <AnimatedInstancedSlots
        slots={slots}
        selectedSlotId={selectedSlotId}
        highlightedFilter={highlightedFilter}
        actionPulse={actionPulse}
        onSelectSlot={onSelectSlot}
      />
      <WarehouseRobotRig
        viewMode={viewMode}
        pivotRef={robotPivotRef}
        driveStateRef={driveStateRef}
        thirdPersonOrbitRef={thirdPersonOrbitRef}
        godOrbitRef={godOrbitRef}
        viewLookApiRef={viewLookApiRef}
        onRobotReady={onRobotReady}
        onGroundClick={() => onSelectSlot(null)}
      />
      <SceneHandleBridge
        handleRef={controlHandleRef}
        containerRef={containerRef}
        driveStateRef={driveStateRef}
        godOrbitRef={godOrbitRef}
        viewMode={viewMode}
      />
      <WebGLCleanup />
    </>
  );
}

function SceneHandleBridge({
  handleRef,
  containerRef,
  driveStateRef,
  godOrbitRef,
  viewMode,
}: {
  handleRef?: React.RefObject<WarehouseSceneHandle | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  driveStateRef: React.RefObject<RobotDriveState | null>;
  godOrbitRef: React.RefObject<GodViewOrbitState>;
  viewMode: WarehouseViewMode;
}) {
  const { gl, scene, camera, invalidate } = useThree();

  useImperativeHandle(
    handleRef,
    () => ({
      captureScreenshot: () =>
        new Promise<Blob | null>((resolve) => {
          invalidate();
          gl.render(scene, camera);
          gl.domElement.toBlob((blob) => resolve(blob), "image/png");
        }),
      requestFullscreen: async () => {
        await containerRef.current?.requestFullscreen();
      },
      exitFullscreen: async () => {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      },
      setRobotDrive: (state) => {
        driveStateRef.current = state;
        invalidate();
      },
      rotateRobotView: (deltaX, deltaY) => {
        if (viewMode !== "god") {
          return;
        }
        const orbit = godOrbitRef.current;
        if (!orbit) {
          return;
        }
        const {
          orbitYawSensitivity,
          orbitPitchSensitivity,
          minPitch,
          maxPitch,
        } = WAREHOUSE_ROBOT.godView;
        orbit.yaw -= deltaX * orbitYawSensitivity;
        orbit.pitch = THREE.MathUtils.clamp(
          orbit.pitch - deltaY * orbitPitchSensitivity,
          minPitch,
          maxPitch,
        );
        invalidate();
      },
    }),
    [camera, containerRef, driveStateRef, gl, godOrbitRef, invalidate, scene, viewMode],
  );

  return null;
}

export const WarehouseScene = forwardRef<WarehouseSceneHandle, WarehouseSceneProps>(function WarehouseScene(
  { slots, selectedSlotId, highlightedFilter, viewMode, actionPulse, onSelectSlot, controlHandleRef },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerHandleRef = useRef<WarehouseSceneHandle | null>(null);
  const [robotLoading, setRobotLoading] = useState(true);
  const handleRobotReady = useCallback(() => setRobotLoading(false), []);
  const cameraConfig = useMemo(() => {
    if (viewMode === "robot") {
      return ROBOT_VIEW_CAMERA;
    }
    if (viewMode === "third") {
      return THIRD_PERSON_VIEW_CAMERA;
    }
    return GOD_VIEW_CAMERA;
  }, [viewMode]);

  useImperativeHandle(
    ref,
    () => ({
      captureScreenshot: () => innerHandleRef.current?.captureScreenshot() ?? Promise.resolve(null),
      requestFullscreen: () => innerHandleRef.current?.requestFullscreen() ?? Promise.resolve(),
      exitFullscreen: () => innerHandleRef.current?.exitFullscreen() ?? Promise.resolve(),
      setRobotDrive: (state) => innerHandleRef.current?.setRobotDrive(state),
      rotateRobotView: (deltaX, deltaY) => innerHandleRef.current?.rotateRobotView(deltaX, deltaY),
    }),
    [],
  );

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="三维快递仓库货位场景，点击货位可选中并查看详情"
      className={cn(
        "relative h-[58vh] min-h-[440px] overflow-hidden rounded-3xl border border-cyan-200/15 bg-slate-950/80 shadow-[0_0_60px_rgba(34,211,238,0.08)] sm:h-[620px]",
        viewMode === "robot" && "cursor-default",
      )}
    >
      <Canvas
        frameloop="demand"
        dpr={1}
        shadows="soft"
        gl={WAREHOUSE_CANVAS_GL}
        camera={cameraConfig}
        onCreated={({ gl, camera, invalidate }) => {
          gl.sortObjects = true;
          gl.toneMappingExposure = 1.08;
          if (viewMode === "third") {
            applyThirdPersonCamera(camera);
          } else if (viewMode === "god") {
            applyGodViewCamera(camera);
          }
          invalidate();
        }}
      >
        <SceneContent
          slots={slots}
          selectedSlotId={selectedSlotId}
          highlightedFilter={highlightedFilter}
          viewMode={viewMode}
          actionPulse={actionPulse}
          onSelectSlot={onSelectSlot}
          onRobotReady={handleRobotReady}
          controlHandleRef={controlHandleRef ?? innerHandleRef}
          containerRef={containerRef}
        />
      </Canvas>
      {robotLoading ? (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-slate-950/35 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-cyan-300/25 bg-slate-950/90 px-5 py-3 text-sm font-medium text-cyan-100 shadow-lg backdrop-blur-sm">
            <span
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-cyan-300/25 border-t-cyan-300"
              aria-hidden
            />
            机器人正在加载中…
          </div>
        </div>
      ) : null}
    </div>
  );
});
