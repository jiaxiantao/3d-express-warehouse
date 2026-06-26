import type { RobotDriveState } from "@/lib/warehouse-robot-drive";

/** 与 3D 场景句柄相关的类型 — 独立文件，避免首页 bundle 拉入 Three.js */
export type WarehouseSceneHandle = {
  captureScreenshot: () => Promise<Blob | null>;
  requestFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  /** 持续驱动机器人：前进/后退 + 左右转向；传 null 停止 */
  setRobotDrive: (state: RobotDriveState | null) => void;
  /** 上帝视角下拖拽旋转环绕镜头（像素增量） */
  rotateRobotView: (deltaX: number, deltaY: number) => void;
};
