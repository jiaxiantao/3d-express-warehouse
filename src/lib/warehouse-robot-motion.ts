/** 机器人运动状态，供行走动画与控制器共享 */
export type RobotMotionState = {
  isMoving: boolean;
  /** 0–1，当前步进相对满速的比例 */
  speed: number;
  /** 行进方向：+1 沿机身朝向前进，-1 后退，0 无平移（用于动画正放/倒放） */
  moveSign: number;
  /** 本帧绕 Y 轴转角（弧度），用于转弯倾斜 */
  turnRate: number;
};

export function createRobotMotionState(): RobotMotionState {
  return {
    isMoving: false,
    speed: 0,
    moveSign: 0,
    turnRate: 0,
  };
}
