import {
  getAisleWorldZ,
  getRackOriginX,
  getRackWidth,
  getWarehouseFenceBounds,
  getWarehouseRackFootprintBounds,
  WAREHOUSE_LAYOUT,
} from "@/lib/warehouse-layout";
import { WAREHOUSE_ROBOT } from "@/lib/warehouse-robot-config";

export type RobotMoveTarget = {
  x: number;
  z: number;
};

export type WalkCorridor = {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

const { rackDepth, aisles } = WAREHOUSE_LAYOUT;

function getRackXBounds() {
  const margin = WAREHOUSE_ROBOT.bodyRadius;
  return {
    minX: getRackOriginX() + margin,
    maxX: getRackOriginX() + getRackWidth() - margin,
  };
}

/** 货架外侧周界通道中心 X（保证不在架体占地内） */
function getBypassLaneX(side: "left" | "right"): number {
  const fenceWalk = getFenceWalkBounds();
  const rackMinX = getRackOriginX();
  const rackMaxX = getRackOriginX() + getRackWidth();
  const clearance = WAREHOUSE_ROBOT.bodyRadius;

  if (side === "left") {
    const laneMaxX = rackMinX - clearance;
    return (fenceWalk.minX + laneMaxX) / 2;
  }

  const laneMinX = rackMaxX + clearance;
  return (laneMinX + fenceWalk.maxX) / 2;
}

/** 栅栏内侧可行走边界（扣除机身半径） */
export function getFenceWalkBounds() {
  const fence = getWarehouseFenceBounds();
  const margin = WAREHOUSE_ROBOT.bodyRadius;
  return {
    minX: fence.minX + margin,
    maxX: fence.maxX - margin,
    minZ: fence.minZ + margin,
    maxZ: fence.maxZ - margin,
  };
}

function clampToFenceWalkBounds(point: RobotMoveTarget): RobotMoveTarget {
  const fenceWalk = getFenceWalkBounds();
  return {
    x: Math.min(fenceWalk.maxX, Math.max(fenceWalk.minX, point.x)),
    z: Math.min(fenceWalk.maxZ, Math.max(fenceWalk.minZ, point.z)),
  };
}

/** 货架之间的巷道 + 栅栏内侧周界通道（均在栅栏内，不进入架体） */
export function getRobotWalkCorridors(): WalkCorridor[] {
  const { minX, maxX } = getRackXBounds();
  const fenceWalk = getFenceWalkBounds();
  const rackFootprint = getWarehouseRackFootprintBounds();
  const rackMinX = getRackOriginX();
  const rackMaxX = getRackOriginX() + getRackWidth();
  const aisleZs = aisles.map((aisle) => getAisleWorldZ(aisle));
  const corridors: WalkCorridor[] = [];
  const clearance = WAREHOUSE_ROBOT.bodyRadius;
  const leftLaneMaxX = rackMinX - clearance;
  const rightLaneMinX = rackMaxX + clearance;

  for (let index = 0; index < aisleZs.length - 1; index += 1) {
    const zMin = aisleZs[index] + rackDepth + clearance;
    const zMax = aisleZs[index + 1] - rackDepth - clearance;
    if (zMax > zMin) {
      const mainId = `main-${aisles[index]}-${aisles[index + 1]}`;
      corridors.push({
        id: mainId,
        minX,
        maxX,
        minZ: zMin,
        maxZ: zMax,
      });

      if (leftLaneMaxX > fenceWalk.minX) {
        corridors.push({
          id: `link-left-${mainId}`,
          minX: leftLaneMaxX,
          maxX: minX,
          minZ: zMin,
          maxZ: zMax,
        });
      }
      if (rightLaneMinX < fenceWalk.maxX) {
        corridors.push({
          id: `link-right-${mainId}`,
          minX: maxX,
          maxX: rightLaneMinX,
          minZ: zMin,
          maxZ: zMax,
        });
      }
    }
  }

  if (leftLaneMaxX > fenceWalk.minX) {
    corridors.push({
      id: "perimeter-left",
      minX: fenceWalk.minX,
      maxX: leftLaneMaxX,
      minZ: fenceWalk.minZ,
      maxZ: fenceWalk.maxZ,
    });
  }

  if (rightLaneMinX < fenceWalk.maxX) {
    corridors.push({
      id: "perimeter-right",
      minX: rightLaneMinX,
      maxX: fenceWalk.maxX,
      minZ: fenceWalk.minZ,
      maxZ: fenceWalk.maxZ,
    });
  }

  const southCapMaxZ = rackFootprint.minZ - clearance;
  if (southCapMaxZ > fenceWalk.minZ) {
    corridors.push({
      id: "perimeter-south",
      minX: fenceWalk.minX,
      maxX: fenceWalk.maxX,
      minZ: fenceWalk.minZ,
      maxZ: southCapMaxZ,
    });
  }

  const northCapMinZ = rackFootprint.maxZ + clearance;
  if (northCapMinZ < fenceWalk.maxZ) {
    corridors.push({
      id: "perimeter-north",
      minX: fenceWalk.minX,
      maxX: fenceWalk.maxX,
      minZ: northCapMinZ,
      maxZ: fenceWalk.maxZ,
    });
  }

  return corridors;
}

/** 单个货架组（左架或右架）在地面上的占用矩形 */
function getRackFootprints(): WalkCorridor[] {
  const minX = getRackOriginX();
  const maxX = getRackOriginX() + getRackWidth();
  const footprints: WalkCorridor[] = [];

  for (const aisle of aisles) {
    const aisleZ = getAisleWorldZ(aisle);
    footprints.push({
      id: `${aisle}-left`,
      minX,
      maxX,
      minZ: aisleZ - rackDepth,
      maxZ: aisleZ,
    });
    footprints.push({
      id: `${aisle}-right`,
      minX,
      maxX,
      minZ: aisleZ,
      maxZ: aisleZ + rackDepth,
    });
  }

  return footprints;
}

export function isInsideRackFootprint(x: number, z: number): boolean {
  return getRackFootprints().some(
    (footprint) =>
      x >= footprint.minX &&
      x <= footprint.maxX &&
      z >= footprint.minZ &&
      z <= footprint.maxZ,
  );
}

function distanceToCorridor(x: number, z: number, corridor: WalkCorridor): RobotMoveTarget {
  return {
    x: Math.min(corridor.maxX, Math.max(corridor.minX, x)),
    z: Math.min(corridor.maxZ, Math.max(corridor.minZ, z)),
  };
}

function corridorContains(
  point: RobotMoveTarget,
  corridor: WalkCorridor,
  epsilon = 0.08,
): boolean {
  return (
    point.x >= corridor.minX - epsilon &&
    point.x <= corridor.maxX + epsilon &&
    point.z >= corridor.minZ - epsilon &&
    point.z <= corridor.maxZ + epsilon
  );
}

/** 将任意点吸附到栅栏内最近巷道 */
export function clampRobotWalkPosition(x: number, z: number): RobotMoveTarget {
  const corridors = getRobotWalkCorridors();
  if (corridors.length === 0) {
    return clampToFenceWalkBounds({ x, z });
  }

  let best: RobotMoveTarget = { x, z };
  let bestDistSq = Number.POSITIVE_INFINITY;

  for (const corridor of corridors) {
    const snapped = distanceToCorridor(x, z, corridor);
    if (isInsideRackFootprint(snapped.x, snapped.z)) {
      continue;
    }
    const distSq = (snapped.x - x) ** 2 + (snapped.z - z) ** 2;
    if (distSq < bestDistSq) {
      best = snapped;
      bestDistSq = distSq;
    }
  }

  if (bestDistSq === Number.POSITIVE_INFINITY) {
    best = clampToFenceWalkBounds({ x, z });
  }

  return clampToFenceWalkBounds(best);
}

/** 移动目标与当前点是否在同一巷道内（避免直线穿模穿越货架） */
export function isSameWalkCorridor(
  from: RobotMoveTarget,
  to: RobotMoveTarget,
  epsilon = 0.08,
): boolean {
  return getRobotWalkCorridors().some(
    (corridor) => corridorContains(from, corridor, epsilon) && corridorContains(to, corridor, epsilon),
  );
}

function pathTravelDistance(from: RobotMoveTarget, waypoints: RobotMoveTarget[]): number {
  let total = 0;
  let prev = from;
  for (const waypoint of waypoints) {
    total += Math.hypot(waypoint.x - prev.x, waypoint.z - prev.z);
    prev = waypoint;
  }
  return total;
}

function dedupeWaypoints(waypoints: RobotMoveTarget[]): RobotMoveTarget[] {
  const result: RobotMoveTarget[] = [];
  for (const point of waypoints) {
    const prev = result[result.length - 1];
    if (prev && Math.hypot(point.x - prev.x, point.z - prev.z) < 0.06) {
      continue;
    }
    result.push(point);
  }
  return result;
}

function buildBypassPath(
  start: RobotMoveTarget,
  end: RobotMoveTarget,
  side: "left" | "right",
): RobotMoveTarget[] {
  const laneX = getBypassLaneX(side);
  const { minX, maxX } = getRackXBounds();
  const mainEdgeX = side === "left" ? minX : maxX;
  const waypoints: RobotMoveTarget[] = [];

  if (Math.abs(start.x - laneX) > 0.12) {
    waypoints.push(clampRobotWalkPosition(mainEdgeX, start.z));
    waypoints.push(clampRobotWalkPosition(laneX, start.z));
  }

  waypoints.push(clampRobotWalkPosition(laneX, end.z));

  if (Math.abs(end.x - laneX) > 0.12) {
    waypoints.push(clampRobotWalkPosition(mainEdgeX, end.z));
  }

  waypoints.push(end);
  return dedupeWaypoints(waypoints);
}

function isDirectPathClear(from: RobotMoveTarget, to: RobotMoveTarget, samples = 20): boolean {
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;

    if (isInsideRackFootprint(x, z)) {
      return false;
    }

    const snapped = clampRobotWalkPosition(x, z);
    if (Math.hypot(snapped.x - x, snapped.z - z) > 0.18) {
      return false;
    }
  }

  return true;
}

/** 规划路径：可直达时走直线，否则经周界通道折线（各段仍为直线最短） */
export function planRobotWalkPath(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): RobotMoveTarget[] {
  const start = clampRobotWalkPosition(fromX, fromZ);
  const end = clampRobotWalkPosition(toX, toZ);

  if (isSameWalkCorridor(start, end) || isDirectPathClear(start, end)) {
    return [end];
  }

  const viaLeft = buildBypassPath(start, end, "left");
  const viaRight = buildBypassPath(start, end, "right");

  return pathTravelDistance(start, viaLeft) <= pathTravelDistance(start, viaRight) ? viaLeft : viaRight;
}

/**
 * 沿直线朝目标步进（允许斜向），步长不超过 maxStep，并约束在可行走区域。
 */
export function stepRobotTowardTarget(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  maxStep: number,
): RobotMoveTarget {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const distance = Math.hypot(dx, dz);

  if (distance <= WAREHOUSE_ROBOT.arriveDistance) {
    return clampRobotWalkPosition(toX, toZ);
  }

  const step = Math.min(distance, maxStep);
  const ratio = step / distance;
  return clampRobotWalkPosition(fromX + dx * ratio, fromZ + dz * ratio);
}

/** @deprecated 使用 planRobotWalkPath */
export function resolveRobotMoveTarget(
  fromX: number,
  fromZ: number,
  clickX: number,
  clickZ: number,
): RobotMoveTarget {
  return planRobotWalkPath(fromX, fromZ, clickX, clickZ)[0] ?? clampRobotWalkPosition(clickX, clickZ);
}

export function lerpAngle(current: number, target: number, alpha: number): number {
  return current + normalizeAngle(target - current) * alpha;
}

export function normalizeAngle(angle: number): number {
  let normalized = angle;
  while (normalized > Math.PI) {
    normalized -= Math.PI * 2;
  }
  while (normalized < -Math.PI) {
    normalized += Math.PI * 2;
  }
  return normalized;
}
