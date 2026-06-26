"use client";

import { useEffect } from "react";
import type { SlotStatus, WarehouseViewMode } from "@/lib/warehouse-types";

const LEGACY_THIRD_VIEW_MODES = new Set(["overview", "third"]);
const LEGACY_GOD_VIEW_MODES = new Set(["god", "aisle", "top"]);
const VALID_FILTERS: Array<SlotStatus | "all"> = [
  "all",
  "empty",
  "occupied",
  "low",
  "full",
  "warning",
  "reserved",
  "locked",
];

export type WarehouseUrlState = {
  slotId: string | null;
  viewMode: WarehouseViewMode;
  filter: SlotStatus | "all";
  sku: string | null;
};

function readParam(search: URLSearchParams, key: string): string | null {
  const value = search.get(key);
  return value && value.length > 0 ? value : null;
}

function parseViewMode(view: string | null): WarehouseViewMode | undefined {
  if (view === "robot") {
    return "robot";
  }
  if (view && LEGACY_THIRD_VIEW_MODES.has(view)) {
    return "third";
  }
  if (view && LEGACY_GOD_VIEW_MODES.has(view)) {
    return "god";
  }
  return undefined;
}

export function readWarehouseUrlState(): Partial<WarehouseUrlState> {
  if (typeof window === "undefined") {
    return {};
  }
  const search = new URLSearchParams(window.location.search);
  const filter = readParam(search, "filter");

  return {
    slotId: readParam(search, "slot"),
    sku: readParam(search, "sku"),
    viewMode: parseViewMode(readParam(search, "view")),
    filter:
      filter && VALID_FILTERS.includes(filter as SlotStatus | "all")
        ? (filter as SlotStatus | "all")
        : undefined,
  };
}

export function useWarehouseUrlState(state: WarehouseUrlState) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams();
    if (state.slotId) {
      params.set("slot", state.slotId);
    }
    if (state.viewMode !== "god") {
      params.set("view", state.viewMode);
    }
    if (state.filter !== "all") {
      params.set("filter", state.filter);
    }
    // sku 仅用于外部扫码入口，定位成功后由 slot 参数承载，不再写入 URL

    const next = params.toString();
    const current = window.location.search.replace(/^\?/, "");
    if (next === current) {
      return;
    }

    const url = next ? `${window.location.pathname}?${next}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [state.filter, state.slotId, state.viewMode]);
}
