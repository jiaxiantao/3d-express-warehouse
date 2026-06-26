/** 3D 场景布局常量 — 货位网格与货架几何尺寸（单一坐标源） */
export const WAREHOUSE_LAYOUT = {
  aisles: ["A", "B", "C"] as const,
  baysPerAisle: 6,
  levelsPerBay: 4,
  slotWidth: 1.15,
  slotHeight: 0.75,
  slotDepth: 0.95,
  bayGap: 0.12,
  levelGap: 0.08,
  aisleSpacing: 5.5,
  rackDepth: 1.1,
  aisleCenterX: 0,
  groundY: 0,
} as const;

export type WarehouseAisle = (typeof WAREHOUSE_LAYOUT.aisles)[number];

/** 货架立柱厚度 */
export const RACK_POST_THICKNESS = 0.07;
/** 货架横梁厚度 */
export const RACK_BEAM_THICKNESS = 0.05;
/** 货位相对格口缩放，留出与立柱/横梁间隙 */
export const SLOT_FIT_RATIO = 0.86;
/** 深度方向额外收缩，避免货箱突出货架立柱平面 */
export const SLOT_DEPTH_FIT_RATIO = 0.82;
/** 货位抬离横梁的高度 */
export const SLOT_BEAM_CLEARANCE = 0.02;

const { slotWidth, slotHeight, bayGap, levelGap, baysPerAisle, levelsPerBay, aisleSpacing, aisles, rackDepth, aisleCenterX, groundY } =
  WAREHOUSE_LAYOUT;

export function getBayPitch(): number {
  return slotWidth + bayGap;
}

export function getLevelPitch(): number {
  return slotHeight + levelGap;
}

/** 货架总宽（含末端立柱） */
export function getRackWidth(): number {
  return baysPerAisle * getBayPitch() + RACK_POST_THICKNESS;
}

/** 货架总高 */
export function getRackHeight(): number {
  return levelsPerBay * getLevelPitch() + RACK_BEAM_THICKNESS;
}

/** 货架组 X 原点（左下角立柱外侧） */
export function getRackOriginX(): number {
  return aisleCenterX - getRackWidth() / 2;
}

export function getAisleIndex(aisle: string): number {
  return aisles.indexOf(aisle as WarehouseAisle);
}

export function getAisleWorldZ(aisle: string): number {
  const aisleIndex = getAisleIndex(aisle);
  if (aisleIndex < 0) {
    return 0;
  }
  return (aisleIndex - (aisles.length - 1) / 2) * aisleSpacing;
}

export function getAisleWorldZByIndex(aisleIndex: number): number {
  return (aisleIndex - (aisles.length - 1) / 2) * aisleSpacing;
}

/** 货位中心 X（按 bay 对齐货架格口） */
export function getBayCenterX(bay: number): number {
  return getRackOriginX() + RACK_POST_THICKNESS + (bay - 0.5) * getBayPitch();
}

/** 货位中心 Y（坐在横梁上方） */
export function getLevelCenterY(level: number): number {
  return groundY + (level - 1) * getLevelPitch() + RACK_BEAM_THICKNESS + SLOT_BEAM_CLEARANCE + slotHeight / 2;
}

/** 横梁中心 Y */
export function getBeamCenterY(level: number): number {
  return groundY + (level - 1) * getLevelPitch() + RACK_BEAM_THICKNESS / 2;
}

/** 顶部封顶横梁中心 Y（相对货架组地面） */
export function getRackTopBeamLocalY(): number {
  return getRackHeight() - RACK_BEAM_THICKNESS / 2;
}

/** 货架前面（朝向巷道一侧）的世界 Z */
export function getRackFrontZ(side: "left" | "right", aisleZ: number): number {
  return aisleZ;
}

/** 货架后面（靠仓库内侧）的世界 Z */
export function getRackBackZ(side: "left" | "right", aisleZ: number): number {
  return side === "left" ? aisleZ - rackDepth : aisleZ + rackDepth;
}

/** 纵深横梁中心 Z（相对 aisle 原点的局部坐标） */
export function getRackDepthBeamCenterZ(side: "left" | "right"): number {
  const frontZ = side === "left" ? -RACK_POST_THICKNESS / 2 : RACK_POST_THICKNESS / 2;
  const backZ =
    side === "left" ? -rackDepth + RACK_POST_THICKNESS / 2 : rackDepth - RACK_POST_THICKNESS / 2;
  return (frontZ + backZ) / 2;
}

/** 货架前/后横梁的局部 Z */
export function getRackFrontLocalZ(side: "left" | "right"): number {
  return side === "left" ? -RACK_POST_THICKNESS / 2 : RACK_POST_THICKNESS / 2;
}

export function getRackBackLocalZ(side: "left" | "right"): number {
  return side === "left" ? -rackDepth + RACK_POST_THICKNESS / 2 : rackDepth - RACK_POST_THICKNESS / 2;
}

/** 纵深横梁跨度 */
export function getRackDepthSpan(): number {
  return rackDepth - RACK_POST_THICKNESS;
}

/** 列与列之间纵深横梁的局部 X（相对货架组原点，不含两端立柱） */
export function getBayDividerLocalXs(): number[] {
  const xs: number[] = [];
  for (let bay = 1; bay < baysPerAisle; bay += 1) {
    xs.push(RACK_POST_THICKNESS + bay * getBayPitch());
  }
  return xs;
}

/** 每隔一列的列间竖立柱局部 X（第 2|3、4|5… 列分界，非两端列缝） */
export function getBayDividerPostLocalXs(): number[] {
  const xs: number[] = [];
  for (let bay = 2; bay < baysPerAisle; bay += 2) {
    xs.push(RACK_POST_THICKNESS + bay * getBayPitch());
  }
  return xs;
}

/** @deprecated 使用 getRackFrontZ / getRackBackZ */
export function getRackFrameZ(side: "left" | "right", aisleZ: number): number {
  return getRackFrontZ(side, aisleZ);
}

/** 货位中心 Z（在货架纵深范围内，略靠巷道） */
export function getSlotCenterZ(side: "left" | "right", aisleZ: number): number {
  const frontZ = getRackFrontZ(side, aisleZ);
  const backZ = getRackBackZ(side, aisleZ);
  const towardAisle = (frontZ - backZ) * 0.15;
  return (frontZ + backZ) / 2 + towardAisle;
}

export function getSlotWorldPosition(slot: {
  aisle: string;
  bay: number;
  level: number;
  side: "left" | "right";
}): [number, number, number] {
  const aisleZ = getAisleWorldZ(slot.aisle);
  return [getBayCenterX(slot.bay), getLevelCenterY(slot.level), getSlotCenterZ(slot.side, aisleZ)];
}

/** 渲染后货位箱体半宽/半高/半深（与 warehouse-scene 缩放一致） */
export function getSlotRenderedHalfExtents() {
  return {
    halfWidth: (WAREHOUSE_LAYOUT.slotWidth * SLOT_FIT_RATIO) / 2,
    halfHeight: (WAREHOUSE_LAYOUT.slotHeight * SLOT_FIT_RATIO) / 2,
    halfDepth: (WAREHOUSE_LAYOUT.slotDepth * SLOT_FIT_RATIO * SLOT_DEPTH_FIT_RATIO) / 2,
  };
}

/** 巷道外侧法线：左架朝 -Z（背向巷道中线），右架朝 +Z */
export function getSlotAisleFaceNormal(side: "left" | "right"): [number, number, number] {
  return side === "left" ? [0, 0, -1] : [0, 0, 1];
}

/** 货位箱体朝巷道外侧那一面的几何中心（背向左右架之间的中线横梁） */
export function getSlotAisleFaceCenter(slot: {
  aisle: string;
  bay: number;
  level: number;
  side: "left" | "right";
}): [number, number, number] {
  const [cx, cy, cz] = getSlotWorldPosition(slot);
  const { halfDepth } = getSlotRenderedHalfExtents();

  // 左架在巷道中线 -Z 侧，外侧为 -Z 面；右架在 +Z 侧，外侧为 +Z 面
  const faceZ = slot.side === "left" ? cz - halfDepth : cz + halfDepth;

  return [cx, cy, faceZ];
}

/** 仓储区栅栏 — 围合全部货架，机器人活动范围限于栅栏内侧 */
export const WAREHOUSE_FENCE = {
  /** 栅栏内侧相对货架外缘留白，供机器人沿墙行走与转弯 */
  innerPadding: 2.6,
  height: 1.32,
  postSize: 0.07,
  postSpacing: 0.9,
  railThickness: 0.04,
} as const;

/** 全部货架在地面上的外轮廓（含左右架体深度） */
export function getWarehouseRackFootprintBounds() {
  const aisleZs = aisles.map((aisle) => getAisleWorldZ(aisle));
  return {
    minX: getRackOriginX(),
    maxX: getRackOriginX() + getRackWidth(),
    minZ: aisleZs[0] - rackDepth,
    maxZ: aisleZs[aisleZs.length - 1] + rackDepth,
  };
}

/** 栅栏内缘矩形（世界坐标，地面 XZ） */
export function getWarehouseFenceBounds() {
  const rack = getWarehouseRackFootprintBounds();
  const pad = WAREHOUSE_FENCE.innerPadding;
  return {
    minX: rack.minX - pad,
    maxX: rack.maxX + pad,
    minZ: rack.minZ - pad,
    maxZ: rack.maxZ + pad,
  };
}

/** 点击点是否在栅栏围合的仓储区内（含边界） */
export function isPointInsideWarehouseFence(x: number, z: number): boolean {
  const { minX, maxX, minZ, maxZ } = getWarehouseFenceBounds();
  return x >= minX && x <= maxX && z >= minZ && z <= maxZ;
}
