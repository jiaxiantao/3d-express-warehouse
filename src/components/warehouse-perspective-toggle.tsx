"use client";

import { cn } from "@/lib/utils";
import type { WarehouseViewMode } from "@/lib/warehouse-types";

type WarehousePerspectiveToggleProps = {
  viewMode: WarehouseViewMode;
  onChangeViewMode: (mode: WarehouseViewMode) => void;
};

const VIEW_OPTIONS: Array<{ mode: WarehouseViewMode; label: string; title: string }> = [
  {
    mode: "god",
    label: "上帝视角",
    title: "鸟瞰仓库，可拖拽自由环视",
  },
  {
    mode: "third",
    label: "第三人称",
    title: "机器人身后追尾视角，随机身朝向转动",
  },
  {
    mode: "robot",
    label: "第一人称",
    title: "以仓储机器人眼睛朝向浏览",
  },
];

export function WarehousePerspectiveToggle({
  viewMode,
  onChangeViewMode,
}: WarehousePerspectiveToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="视角模式"
      className="inline-flex rounded-full border border-white/10 bg-slate-900/80 p-1 text-xs"
    >
      {VIEW_OPTIONS.map(({ mode, label, title }) => {
        const active = viewMode === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            title={title}
            onClick={() => onChangeViewMode(mode)}
            className={cn(
              "rounded-full px-3 py-1.5 font-medium transition-all duration-200",
              active
                ? "bg-cyan-300 text-slate-950 shadow-md"
                : "text-slate-300 hover:bg-white/5 hover:text-white",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
