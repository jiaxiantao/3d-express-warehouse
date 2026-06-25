"use client";

import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { OrbitControls as ThreeOrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import {
  actionProgress,
  getActionVisual,
  isActionRunning,
  type WarehouseActionPulse,
} from "@/lib/warehouse-animations";
import { getSlotSelectionOutlineColors, SLOT_STATUS_COLORS } from "@/lib/warehouse-colors";
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
import type { WarehouseSceneHandle } from "@/lib/warehouse-scene-types";

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

const ORBIT_TARGET = new THREE.Vector3(0, 2.5, 0);

const VIEW_CAMERA: Record<WarehouseViewMode, THREE.Vector3> = {
  overview: new THREE.Vector3(9, 6.5, 11),
  aisle: new THREE.Vector3(1.5, 4, 7),
  top: new THREE.Vector3(0.5, 15, 0.5),
};

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

function createStatusSlotMaterials(): Record<SlotStatus, THREE.MeshBasicMaterial> {
  return Object.fromEntries(
    SLOT_STATUSES.map((status) => [
      status,
      new THREE.MeshBasicMaterial({
        color: SLOT_STATUS_COLORS[status],
        toneMapped: false,
      }),
    ]),
  ) as Record<SlotStatus, THREE.MeshBasicMaterial>;
}

const rackPostMaterial = new THREE.MeshLambertMaterial({ color: "#b8c5d8" });
const rackBeamMaterial = new THREE.MeshLambertMaterial({ color: "#dce4f0" });

const floorPickGeometry = new THREE.PlaneGeometry(80, 80);

/** 状态筛选时，非匹配货位半透明（独立 mesh 绘制，避免 InstancedMesh 透明缺面） */
const FILTER_DIM_TARGET = new THREE.Color("#0b1220");
const FILTER_DIM_COLOR_LERP = 0.18;
const FILTER_DIM_OPACITY = 0.22;
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
  material: THREE.MeshBasicMaterial,
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
  } else if (emphasized) {
    material.color.lerp(FILTER_EMPHASIS_TINT, FILTER_EMPHASIS_LERP);
    material.opacity = 1;
    material.transparent = false;
    material.depthWrite = true;
  } else {
    material.opacity = 1;
    material.transparent = false;
    material.depthWrite = true;
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
  const hovered = slotIndex === hoveredIndex;

  let scaleMul = 1;
  let shakeX = 0;
  let yLift = 0;

  if (actionRef?.localIndex === localIndex) {
    const visual = getActionVisual(actionRef.action, actionProgress(actionRef.startedAt, now));
    scaleMul = visual.scaleMul;
    shakeX = visual.shakeX;
    yLift = visual.yLift;
  }

  const interact = hovered ? 1.02 : 1;

  return {
    x: x + shakeX,
    y: y + yLift,
    z,
    sx: SLOT_FIT_RATIO * interact * scaleMul,
    sy: SLOT_FIT_RATIO * interact * scaleMul,
    sz: SLOT_FIT_RATIO * SLOT_DEPTH_FIT_RATIO * interact * scaleMul,
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

function createSelectedOutlineLines(colors: { base: number; flow: number; glow: number }) {
  const lineGeometry = new LineSegmentsGeometry();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const edges = new THREE.EdgesGeometry(box, 15);
  lineGeometry.fromEdgesGeometry(edges);
  box.dispose();
  edges.dispose();

  const baseMaterial = new LineMaterial({
    color: colors.base,
    linewidth: 0.028,
    worldUnits: true,
    transparent: true,
    opacity: 0.9,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });

  const flowMaterial = new LineMaterial({
    color: colors.flow,
    linewidth: 0.044,
    worldUnits: true,
    dashed: true,
    dashSize: 0.22,
    gapSize: 0.09,
    dashScale: 1.1,
    transparent: true,
    opacity: 1,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });

  const glowMaterial = new LineMaterial({
    color: colors.glow,
    linewidth: 0.072,
    worldUnits: true,
    dashed: true,
    dashSize: 0.34,
    gapSize: 0.14,
    dashScale: 0.95,
    transparent: true,
    opacity: 0.38,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });

  const baseLine = new LineSegments2(lineGeometry, baseMaterial);
  const flowLine = new LineSegments2(lineGeometry, flowMaterial);
  const glowLine = new LineSegments2(lineGeometry, glowMaterial);
  baseLine.computeLineDistances();
  flowLine.computeLineDistances();
  glowLine.computeLineDistances();
  baseLine.renderOrder = 8;
  flowLine.renderOrder = 10;
  glowLine.renderOrder = 9;

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
  const outlineDashRef = useRef<{ flow: LineMaterial; glow: LineMaterial } | null>(null);
  const outlineLines = useMemo(() => {
    const colors = {
      base: new THREE.Color(outlinePalette.base).getHex(),
      flow: new THREE.Color(outlinePalette.flow).getHex(),
      glow: new THREE.Color(outlinePalette.glow).getHex(),
    };
    return createSelectedOutlineLines(colors);
  }, [outlinePalette]);
  const { lineGeometry, baseLine, flowLine, glowLine } = outlineLines;

  useLayoutEffect(() => {
    outlineDashRef.current = {
      flow: flowLine.material as LineMaterial,
      glow: glowLine.material as LineMaterial,
    };
  }, [flowLine, glowLine]);

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

    const dash = outlineDashRef.current;
    if (!reducedMotion && dash) {
      dash.flow.dashOffset = -state.clock.elapsedTime * 1.8;
      dash.glow.dashOffset = state.clock.elapsedTime * 1.1;
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
  material: THREE.MeshBasicMaterial;
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
                    renderOrder={1}
                  />
                  <mesh
                    position={[beamCenterX, beamY, backZ]}
                    geometry={xBeamGeometry}
                    material={rackBeamMaterial}
                    renderOrder={1}
                  />
                  <mesh
                    position={[leftPostX, beamY, depthBeamZ]}
                    geometry={zBeamGeometry}
                    material={rackBeamMaterial}
                    renderOrder={1}
                  />
                  <mesh
                    position={[rightPostX, beamY, depthBeamZ]}
                    geometry={zBeamGeometry}
                    material={rackBeamMaterial}
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
                      renderOrder={1}
                    />,
                    <mesh
                      key={`mid-post-back-${dividerX}`}
                      position={[dividerX, rackHeight / 2, backZ]}
                      scale={[1, rackHeight, 1]}
                      geometry={postGeometry}
                      material={rackPostMaterial}
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

function WarehouseControls({ viewMode }: { viewMode: WarehouseViewMode }) {
  const { camera, gl, invalidate } = useThree();
  const controlsRef = useRef<ThreeOrbitControls | null>(null);
  const targetCameraPos = useRef(VIEW_CAMERA[viewMode].clone());
  const transitioning = useRef(false);

  useEffect(() => {
    const controls = new ThreeOrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.minDistance = 4;
    controls.maxDistance = 28;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.target.copy(ORBIT_TARGET);

    const handleChange = () => invalidate();
    controls.addEventListener("change", handleChange);
    controlsRef.current = controls;
    invalidate();

    return () => {
      controls.removeEventListener("change", handleChange);
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl, invalidate]);

  useEffect(() => {
    targetCameraPos.current.copy(VIEW_CAMERA[viewMode]);
    transitioning.current = true;
    invalidate();
  }, [invalidate, viewMode]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    if (transitioning.current) {
      camera.position.lerp(targetCameraPos.current, 0.08);
      controls.target.lerp(ORBIT_TARGET, 0.1);
      if (camera.position.distanceTo(targetCameraPos.current) < 0.05) {
        transitioning.current = false;
      }
      controls.update();
      invalidate();
      return;
    }

    controls.update();
  });

  return null;
}

function SceneContent({
  slots,
  selectedSlotId,
  highlightedFilter,
  viewMode,
  actionPulse,
  onSelectSlot,
}: Omit<WarehouseSceneProps, "controlHandleRef">) {
  return (
    <>
      <color attach="background" args={["#1a2336"]} />
      <fog attach="fog" args={["#1a2336", 28, 55]} />
      <WarehouseLights />
      <WarehouseFloor />
      <RackFrames />
      <DemandRenderBoot />
      <AnimatedInstancedSlots
        slots={slots}
        selectedSlotId={selectedSlotId}
        highlightedFilter={highlightedFilter}
        actionPulse={actionPulse}
        onSelectSlot={onSelectSlot}
      />
      <WarehouseControls viewMode={viewMode} />
      <mesh
        visible={false}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, WAREHOUSE_GROUND_Y, 0]}
        geometry={floorPickGeometry}
        onClick={() => onSelectSlot(null)}
      />
      <WebGLCleanup />
    </>
  );
}

function ScreenshotBridge({
  handleRef,
  containerRef,
}: {
  handleRef?: React.RefObject<WarehouseSceneHandle | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
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
    }),
    [camera, containerRef, gl, invalidate, scene],
  );

  return null;
}

export const WarehouseScene = forwardRef<WarehouseSceneHandle, WarehouseSceneProps>(function WarehouseScene(
  { slots, selectedSlotId, highlightedFilter, viewMode, actionPulse, onSelectSlot, controlHandleRef },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerHandleRef = useRef<WarehouseSceneHandle | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      captureScreenshot: () => innerHandleRef.current?.captureScreenshot() ?? Promise.resolve(null),
      requestFullscreen: () => innerHandleRef.current?.requestFullscreen() ?? Promise.resolve(),
      exitFullscreen: () => innerHandleRef.current?.exitFullscreen() ?? Promise.resolve(),
    }),
    [],
  );

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="三维快递仓库货位场景，点击货位可选中并查看详情"
      className="relative h-[58vh] min-h-[440px] overflow-hidden rounded-3xl border border-cyan-200/15 bg-slate-950/80 shadow-[0_0_60px_rgba(34,211,238,0.08)] sm:h-[620px]"
    >
      <Canvas
        frameloop="demand"
        dpr={1}
        gl={{ antialias: true, alpha: false, powerPreference: "default", preserveDrawingBuffer: true }}
        camera={{ position: [9, 6.5, 11], fov: 45, near: 0.1, far: 80 }}
        onCreated={({ gl, invalidate }) => {
          gl.sortObjects = true;
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
        />
        <ScreenshotBridge handleRef={controlHandleRef ?? innerHandleRef} containerRef={containerRef} />
      </Canvas>
    </div>
  );
});
