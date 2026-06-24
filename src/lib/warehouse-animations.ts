import type { SlotAction } from "@/lib/warehouse-types";

export type WarehouseActionPulse = {
  seq: number;
  slotId: string;
  action: SlotAction;
};

const ACTION_DURATION_MS = 720;

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function actionProgress(startedAt: number, now = performance.now()): number {
  return Math.min((now - startedAt) / ACTION_DURATION_MS, 1);
}

export function isActionRunning(startedAt: number, now = performance.now()): boolean {
  return now - startedAt < ACTION_DURATION_MS;
}

export type ActionVisual = {
  scaleMul: number;
  glow: number;
  shakeX: number;
  yLift: number;
};

export function getActionVisual(action: SlotAction, progress: number): ActionVisual {
  const t = easeOutCubic(progress);

  switch (action) {
    case "restock":
      return {
        scaleMul: 1 + Math.sin(t * Math.PI) * 0.22,
        glow: Math.sin(t * Math.PI) * 0.45,
        shakeX: 0,
        yLift: Math.sin(t * Math.PI) * 0.08,
      };
    case "clear":
      return {
        scaleMul: 1 - Math.sin(t * Math.PI) * 0.35,
        glow: 0,
        shakeX: 0,
        yLift: -Math.sin(t * Math.PI) * 0.06,
      };
    case "toggle-lock":
      return {
        scaleMul: 1 + Math.sin(t * Math.PI * 4) * 0.04,
        glow: Math.sin(t * Math.PI) * 0.25,
        shakeX: Math.sin(t * Math.PI * 6) * 0.06 * (1 - t),
        yLift: 0,
      };
    case "mark-warning":
      return {
        scaleMul: 1 + Math.sin(t * Math.PI * 3) * 0.1,
        glow: Math.sin(t * Math.PI * 3) * 0.55,
        shakeX: 0,
        yLift: 0,
      };
    case "reserve":
      return {
        scaleMul: 1 + Math.sin(t * Math.PI) * 0.12,
        glow: Math.sin(t * Math.PI) * 0.35,
        shakeX: 0,
        yLift: Math.sin(t * Math.PI) * 0.05,
      };
    default:
      return { scaleMul: 1, glow: 0, shakeX: 0, yLift: 0 };
  }
}
