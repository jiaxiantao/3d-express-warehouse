"use client";

import { SLOT_STATUS_COLORS, SLOT_STATUS_LABELS } from "@/lib/warehouse-colors";
import type { SlotStatus, WarehouseStats } from "@/lib/warehouse-types";

type WarehouseStatsBarProps = {
  stats: WarehouseStats;
  activeFilter: SlotStatus | "all";
  onFilterChange: (filter: SlotStatus | "all") => void;
};

const FILTER_OPTIONS: Array<{ id: SlotStatus | "all"; label: string }> = [
  { id: "all", label: "全部" },
  { id: "occupied", label: "在库" },
  { id: "empty", label: "空闲" },
  { id: "low", label: "低库存" },
  { id: "full", label: "满仓" },
  { id: "warning", label: "异常" },
  { id: "reserved", label: "预留" },
  { id: "locked", label: "锁定" },
];

const STAT_CARDS: Array<{
  label: string;
  accent: string;
  filter: SlotStatus | "all" | null;
  getValue: (stats: WarehouseStats) => string | number;
}> = [
  { label: "总货位", accent: "text-white", filter: null, getValue: (s) => s.totalSlots },
  { label: "在库", accent: "text-emerald-400", filter: null, getValue: (s) => s.occupiedSlots },
  { label: "空闲", accent: "text-slate-400", filter: "empty", getValue: (s) => s.emptySlots },
  { label: "低库存", accent: "text-amber-400", filter: "low", getValue: (s) => s.lowStockSlots },
  { label: "异常", accent: "text-red-400", filter: "warning", getValue: (s) => s.warningSlots },
  { label: "利用率", accent: "text-cyan-300", filter: null, getValue: (s) => `${s.utilizationPercent}%` },
];

export function WarehouseStatsBar({ stats, activeFilter, onFilterChange }: WarehouseStatsBarProps) {
  const handleStatClick = (filter: SlotStatus | "all" | null) => {
    if (!filter) {
      return;
    }
    onFilterChange(activeFilter === filter ? "all" : filter);
  };

  return (
    <section className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STAT_CARDS.map((item) => {
          const clickable = item.filter !== null;
          const isActive = clickable && activeFilter === item.filter;
          const className = `rounded-2xl border px-4 py-3 text-left transition ${
            isActive
              ? "border-cyan-200/50 bg-cyan-200/10"
              : "border-white/10 bg-slate-950/50"
          } ${clickable ? "cursor-pointer hover:border-white/25 hover:bg-slate-900/60" : ""}`;

          const content = (
            <>
              <p className="text-xs text-slate-400">{item.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${item.accent}`}>{item.getValue(stats)}</p>
            </>
          );

          if (!clickable) {
            return (
              <div key={item.label} className={className}>
                {content}
              </div>
            );
          }

          return (
            <button
              key={item.label}
              type="button"
              aria-pressed={isActive}
              aria-label={`按${item.label}筛选货位`}
              className={className}
              onClick={() => handleStatClick(item.filter)}
            >
              {content}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">状态筛选（3D 高亮）：</span>
        {FILTER_OPTIONS.map((option) => {
          const active = activeFilter === option.id;
          const swatch =
            option.id === "all" ? undefined : SLOT_STATUS_COLORS[option.id as SlotStatus];
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onFilterChange(option.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                active
                  ? "border-cyan-200/60 bg-cyan-200/15 text-white"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-white/25"
              }`}
            >
              {swatch ? (
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-white/30"
                  style={{ backgroundColor: swatch }}
                />
              ) : null}
              {option.id === "all" ? "全部" : SLOT_STATUS_LABELS[option.id as SlotStatus]}
            </button>
          );
        })}
      </div>
    </section>
  );
}
