"use client";

import { useEffect } from "react";
import type { SlotStatus, WarehouseViewMode } from "@/lib/warehouse-types";

const VALID_VIEW_MODES: WarehouseViewMode[] = ["overview", "aisle", "top"];
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
};

function readParam(search: URLSearchParams, key: string): string | null {
  const value = search.get(key);
  return value && value.length > 0 ? value : null;
}

export function readWarehouseUrlState(): Partial<WarehouseUrlState> {
  if (typeof window === "undefined") {
    return {};
  }
  const search = new URLSearchParams(window.location.search);
  const viewMode = readParam(search, "view");
  const filter = readParam(search, "filter");

  return {
    slotId: readParam(search, "slot"),
    viewMode:
      viewMode && VALID_VIEW_MODES.includes(viewMode as WarehouseViewMode)
        ? (viewMode as WarehouseViewMode)
        : undefined,
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
    if (state.viewMode !== "overview") {
      params.set("view", state.viewMode);
    }
    if (state.filter !== "all") {
      params.set("filter", state.filter);
    }

    const next = params.toString();
    const current = window.location.search.replace(/^\?/, "");
    if (next === current) {
      return;
    }

    const url = next ? `${window.location.pathname}?${next}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [state.filter, state.slotId, state.viewMode]);
}
