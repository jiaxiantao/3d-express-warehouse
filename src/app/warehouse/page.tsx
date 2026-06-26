"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { WarehouseQuickActions } from "@/components/warehouse-quick-actions";
import { WarehouseRobotPad } from "@/components/warehouse-robot-pad";
import { WarehouseQrScanner } from "@/components/warehouse-qr-scanner";
import { WarehouseSlotPanel } from "@/components/warehouse-slot-panel";
import { WarehouseStatsBar } from "@/components/warehouse-stats-bar";
import type { WarehouseActionPulse } from "@/lib/warehouse-animations";
import {
  applySlotAction,
  computeWarehouseStats,
  createWarehouseState,
  getSlotById,
  isValidSlotId,
} from "@/lib/warehouse-data";
import type { WarehouseSceneHandle } from "@/lib/warehouse-scene-types";
import type { SlotAction, SlotStatus, WarehouseViewMode } from "@/lib/warehouse-types";
import {
  readWarehouseUrlState,
  useWarehouseUrlState,
} from "@/lib/use-warehouse-url-state";
import { resolveWarehouseScan } from "@/lib/warehouse-scan";

const WarehouseScene = dynamic(
  () => import("@/components/warehouse-scene").then((mod) => mod.WarehouseScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[58vh] min-h-[440px] items-center justify-center rounded-3xl border border-cyan-200/10 bg-slate-950/80 text-sm text-slate-400 sm:h-[620px]">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-pulse rounded-full border-2 border-cyan-300/40 border-t-cyan-300" />
          加载 3D 仓库引擎…
        </div>
      </div>
    ),
  },
);

const ACTION_LABELS: Record<SlotAction, string> = {
  restock: "补货完成",
  clear: "货位已清空",
  "toggle-lock": "锁定状态已更新",
  "mark-warning": "异常标记已更新",
  reserve: "预留状态已更新",
};

/** 3D 仓库控制台 */
export default function WarehousePage() {
  const [slots, setSlots] = useState(createWarehouseState);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<WarehouseViewMode>("god");
  const [filter, setFilter] = useState<SlotStatus | "all">("all");
  const [capturing, setCapturing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [actionPulse, setActionPulse] = useState<WarehouseActionPulse | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const sceneHandleRef = useRef<WarehouseSceneHandle | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const statusTimerRef = useRef<number | null>(null);
  const actionSeqRef = useRef(0);

  /* eslint-disable react-hooks/set-state-in-effect -- one-shot URL hydration on mount */
  useEffect(() => {
    const initial = readWarehouseUrlState();
    const seedSlots = createWarehouseState();

    if (initial.slotId && isValidSlotId(initial.slotId) && getSlotById(seedSlots, initial.slotId)) {
      setSelectedSlotId(initial.slotId);
    } else if (initial.sku) {
      const located = resolveWarehouseScan(seedSlots, initial.sku);
      if (located.ok) {
        setSelectedSlotId(located.slot.id);
      }
    }
    if (initial.viewMode) {
      setViewMode(initial.viewMode);
    }
    if (initial.filter) {
      setFilter(initial.filter);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!selectedSlotId) {
      return;
    }
    const mobile = window.matchMedia("(max-width: 1023px)");
    if (mobile.matches) {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedSlotId]);

  useWarehouseUrlState({ slotId: selectedSlotId, viewMode, filter, sku: null });

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const stats = useMemo(() => computeWarehouseStats(slots), [slots]);
  const selectedSlot = useMemo(() => getSlotById(slots, selectedSlotId), [slots, selectedSlotId]);

  const showStatus = useCallback((message: string) => {
    setStatusMessage(message);
    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current);
    }
    statusTimerRef.current = window.setTimeout(() => {
      setStatusMessage(null);
      statusTimerRef.current = null;
    }, 2600);
  }, []);

  useEffect(
    () => () => {
      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current);
      }
    },
    [],
  );

  const locateFromScan = useCallback(
    (raw: string) => {
      const result = resolveWarehouseScan(slots, raw);
      if (!result.ok) {
        showStatus(result.message);
        return;
      }

      setFilter("all");
      setSelectedSlotId(result.slot.id);
      setScannerOpen(false);

      const productLabel = result.slot.productName ?? result.sku ?? result.slot.sku ?? "商品";
      if (result.duplicates > 1) {
        showStatus(`已定位 ${productLabel} → 货位 ${result.slot.id}（共 ${result.duplicates} 个货位）`);
      } else {
        showStatus(`已定位 ${productLabel} → 货位 ${result.slot.id}`);
      }
    },
    [showStatus, slots],
  );

  const handleSlotAction = useCallback(
    (action: SlotAction) => {
      if (!selectedSlotId) {
        return;
      }

      actionSeqRef.current += 1;
      setActionPulse({ seq: actionSeqRef.current, slotId: selectedSlotId, action });
      setSlots((current) => applySlotAction(current, selectedSlotId, action));
      showStatus(ACTION_LABELS[action]);
    },
    [selectedSlotId, showStatus],
  );

  const handleScreenshot = useCallback(async () => {
    if (capturing) {
      return;
    }
    setCapturing(true);
    try {
      const blob = await sceneHandleRef.current?.captureScreenshot();
      if (!blob) {
        showStatus("截图未就绪，请稍候重试");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const filename = `3d-warehouse-${Date.now()}.png`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      showStatus(`已保存 ${filename}`);
    } catch (error) {
      console.warn("[warehouse] screenshot failed", error);
      showStatus("截图失败，请重试");
    } finally {
      setCapturing(false);
    }
  }, [capturing, showStatus]);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await sceneHandleRef.current?.exitFullscreen();
      } else {
        await sceneHandleRef.current?.requestFullscreen();
      }
    } catch (error) {
      console.warn("[warehouse] fullscreen toggle failed", error);
      showStatus("浏览器拒绝全屏请求");
    }
  }, [showStatus]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-300/60">3D Express Warehouse</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">快递仓储三维可视化</h1>
          <p className="text-sm text-slate-400">点击货位查看详情，或扫码 SKU 快速定位商品所在货位</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-2 text-right text-xs text-slate-400">
          <p>
            总货位 <span className="font-semibold text-white">{stats.totalSlots}</span>
          </p>
          <p>
            利用率 <span className="font-semibold text-cyan-300">{stats.utilizationPercent}%</span>
          </p>
        </div>
      </header>

      <WarehouseStatsBar stats={stats} activeFilter={filter} onFilterChange={setFilter} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="relative">
          <WarehouseScene
            slots={slots}
            selectedSlotId={selectedSlotId}
            highlightedFilter={filter}
            viewMode={viewMode}
            actionPulse={actionPulse}
            onSelectSlot={setSelectedSlotId}
            controlHandleRef={sceneHandleRef}
          />

          <div className="pointer-events-none absolute inset-0">
            <div className="absolute bottom-[6.75rem] right-4 z-10 sm:bottom-24">
              <WarehouseRobotPad sceneHandleRef={sceneHandleRef} />
            </div>

            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4">
            {statusMessage ? (
              <div
                role="status"
                aria-live="polite"
                className="wh-toast-in pointer-events-auto mx-auto rounded-full border border-cyan-300/30 bg-slate-950/90 px-4 py-2 text-xs font-medium text-cyan-100 shadow-lg backdrop-blur-sm"
              >
                {statusMessage}
              </div>
            ) : null}

            <div className="pointer-events-auto">
              <WarehouseQuickActions
                viewMode={viewMode}
                onChangeViewMode={setViewMode}
                onCaptureScreenshot={handleScreenshot}
                onToggleFullscreen={handleToggleFullscreen}
                onOpenScanner={() => setScannerOpen(true)}
                isFullscreen={isFullscreen}
                capturing={capturing}
              />
            </div>
            </div>
          </div>
        </div>

        <aside ref={panelRef} className="lg:sticky lg:top-6">
          <WarehouseSlotPanel
            slot={selectedSlot}
            onAction={handleSlotAction}
            onClose={() => setSelectedSlotId(null)}
          />
        </aside>
      </div>

      {scannerOpen ? (
        <WarehouseQrScanner onClose={() => setScannerOpen(false)} onScan={locateFromScan} />
      ) : null}
    </main>
  );
}
