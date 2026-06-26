export type RobotMoveDirection = "forward" | "back";
export type RobotTurnDirection = "left" | "right";

/** 机器人驱动状态：可同时前进/后退并左右转向（像游戏里按住前进同时转弯） */
export type RobotDriveState = {
  move: RobotMoveDirection | null;
  turn: RobotTurnDirection | null;
};

/** 沿机身朝向前进（forward）或后退（back）的单位位移 */
export function getBodyForwardUnitVector(bodyYaw: number, direction: RobotMoveDirection) {
  const sin = Math.sin(bodyYaw);
  const cos = Math.cos(bodyYaw);
  if (direction === "forward") {
    return { x: sin, z: cos };
  }
  return { x: -sin, z: -cos };
}
