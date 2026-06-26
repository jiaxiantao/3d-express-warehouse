"use client";

import { WarehousePerspectiveToggle } from "@/components/warehouse-perspective-toggle";
import type { WarehouseViewMode } from "@/lib/warehouse-types";

type WarehouseQuickActionsProps = {
  viewMode: WarehouseViewMode;
  onChangeViewMode: (mode: WarehouseViewMode) => void;
  onCaptureScreenshot: () => void;
  onToggleFullscreen: () => void;
  onOpenScanner: () => void;
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
  onOpenScanner,
  isFullscreen,
  capturing,
}: WarehouseQuickActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/60 p-2 shadow-xl backdrop-blur-md">
      <WarehousePerspectiveToggle viewMode={viewMode} onChangeViewMode={onChangeViewMode} />

      <button
        type="button"
        onClick={onOpenScanner}
        className={ICON_BUTTON_CLASS}
        aria-label="扫描二维码定位商品货位"
      >
        <span aria-hidden>⌁</span>
        <span>扫码定位</span>
      </button>
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
