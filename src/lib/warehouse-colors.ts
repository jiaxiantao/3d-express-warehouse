import type { SlotStatus } from "@/lib/warehouse-types";

export const SLOT_STATUS_LABELS: Record<SlotStatus, string> = {
  empty: "空闲",
  occupied: "在库",
  low: "低库存",
  full: "满仓",
  warning: "异常",
  reserved: "预留",
  locked: "锁定",
};

/** 状态筛选时非匹配货位/标签共用透明度 */
export const FILTER_DIM_OPACITY = 0.22;
export const SLOT_STATUS_COLORS: Record<SlotStatus, string> = {
  empty: "#b0bccf",
  occupied: "#5eead4",
  low: "#fde047",
  full: "#7dd3fc",
  warning: "#fb7185",
  reserved: "#d8b4fe",
  locked: "#8b9cb3",
};

function mixHexWithWhite(hex: string, whiteMix: number): string {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * whiteMix);
  const toHex = (channel: number) => mix(channel).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** 选中描边配色：与货位状态色同系，流动层更亮、光晕层更柔 */
export function getSlotSelectionOutlineColors(status: SlotStatus): {
  base: string;
  flow: string;
  glow: string;
} {
  const base = SLOT_STATUS_COLORS[status];
  return {
    base,
    flow: mixHexWithWhite(base, 0.55),
    glow: mixHexWithWhite(base, 0.38),
  };
}
