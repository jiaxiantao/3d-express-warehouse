"use client";

import { cn } from "@/lib/utils";
import type { WarehouseViewMode } from "@/lib/warehouse-types";

const VIEW_MODES: Array<{ id: WarehouseViewMode; label: string; description: string }> = [
  { id: "overview", label: "全景", description: "鸟瞰整个仓库布局" },
  { id: "aisle", label: "巷道", description: "沿巷道方向查看货架" },
  { id: "top", label: "俯视", description: "顶视查看货位分布" },
];

type WarehouseQuickActionsProps = {
  viewMode: WarehouseViewMode;
  onChangeViewMode: (mode: WarehouseViewMode) => void;
  onCaptureScreenshot: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  capturing?: boolean;
};

const ICON_BUTTON_CLASS =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-slate-950/80 px-3 text-xs font-medium text-slate-100 shadow-lg backdrop-blur-sm transition hover:border-cyan-300/30 hover:bg-slate-900/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60 disabled:opacity-50";

export function WarehouseQuickActions({
  viewMode,
  onChangeViewMode,
  onCaptureScreenshot,
  onToggleFullscreen,
  isFullscreen,
  capturing,
}: WarehouseQuickActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/60 p-2 shadow-xl backdrop-blur-md">
      <div
        role="radiogroup"
        aria-label="仓库视角"
        className="inline-flex rounded-full border border-white/10 bg-slate-900/80 p-1 text-xs"
      >
        {VIEW_MODES.map((mode) => {
          const isActive = viewMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              title={mode.description}
              onClick={() => onChangeViewMode(mode.id)}
              className={cn(
                "rounded-full px-3 py-1.5 transition-all duration-300",
                isActive
                  ? "bg-cyan-300 text-slate-950 shadow-md scale-105"
                  : "text-slate-300 hover:text-white hover:bg-white/5",
              )}
            >
              {mode.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onCaptureScreenshot}
        disabled={capturing}
        className={ICON_BUTTON_CLASS}
        aria-label="保存当前画面为图片"
      >
        <span aria-hidden>📸</span>
        <span>{capturing ? "保存中…" : "截图"}</span>
      </button>
      <button
        type="button"
        onClick={onToggleFullscreen}
        className={ICON_BUTTON_CLASS}
        aria-label={isFullscreen ? "退出全屏" : "进入全屏"}
        aria-pressed={isFullscreen}
      >
        <span aria-hidden>{isFullscreen ? "✕" : "⛶"}</span>
        <span>{isFullscreen ? "退出全屏" : "全屏查看"}</span>
      </button>
    </div>
  );
}
