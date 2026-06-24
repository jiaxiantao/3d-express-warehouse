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
