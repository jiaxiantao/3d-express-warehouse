import { getSlotById, isValidSlotId } from "@/lib/warehouse-data";
import type { WarehouseSlot } from "@/lib/warehouse-types";

export type WarehouseScanTarget = { kind: "sku" | "slot"; value: string };

export type WarehouseScanResolveResult =
  | { ok: true; slot: WarehouseSlot; duplicates: number; sku?: string }
  | { ok: false; message: string };

const SKU_PATTERN = /^SKU-\d{4}$/i;

function tryParseUrlPayload(raw: string): WarehouseScanTarget | null {
  try {
    const url = new URL(raw);
    const sku = url.searchParams.get("sku");
    if (sku?.trim()) {
      return { kind: "sku", value: sku.trim() };
    }
    const slot = url.searchParams.get("slot");
    if (slot?.trim()) {
      return { kind: "slot", value: slot.trim() };
    }
  } catch {
    // not a URL
  }
  return null;
}

/** 解析二维码 / 条形码文本为 SKU 或货位 ID */
export function parseWarehouseScanPayload(raw: string): WarehouseScanTarget | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const fromUrl = tryParseUrlPayload(trimmed);
  if (fromUrl) {
    return fromUrl;
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("3dew:")) {
    const [, kind, ...rest] = trimmed.split(":");
    const value = rest.join(":").trim();
    if ((kind === "sku" || kind === "slot") && value) {
      return { kind, value };
    }
  }

  if (isValidSlotId(trimmed)) {
    return { kind: "slot", value: trimmed };
  }

  if (SKU_PATTERN.test(trimmed)) {
    return { kind: "sku", value: trimmed.toUpperCase() };
  }

  return null;
}

export function findSlotsBySku(slots: WarehouseSlot[], sku: string): WarehouseSlot[] {
  const normalized = sku.trim().toUpperCase();
  return slots.filter((slot) => slot.sku?.toUpperCase() === normalized);
}

export function resolveWarehouseScan(slots: WarehouseSlot[], raw: string): WarehouseScanResolveResult {
  const target = parseWarehouseScanPayload(raw);
  if (!target) {
    return { ok: false, message: "无法识别的二维码，请扫描商品 SKU 或货位码" };
  }

  if (target.kind === "slot") {
    if (!isValidSlotId(target.value)) {
      return { ok: false, message: "货位编码格式无效" };
    }
    const slot = getSlotById(slots, target.value);
    if (!slot) {
      return { ok: false, message: `仓库中未找到货位 ${target.value}` };
    }
    return { ok: true, slot, duplicates: 1 };
  }

  const matches = findSlotsBySku(slots, target.value);
  if (matches.length === 0) {
    return { ok: false, message: `未找到 SKU ${target.value} 所在货位` };
  }

  return {
    ok: true,
    slot: matches[0],
    duplicates: matches.length,
    sku: target.value.toUpperCase(),
  };
}
