/** 与 3D 场景句柄相关的类型 — 独立文件，避免首页 bundle 拉入 Three.js */
export type WarehouseSceneHandle = {
  captureScreenshot: () => Promise<Blob | null>;
  requestFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
};
