"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { SLOT_STATUS_LABELS } from "@/lib/warehouse-colors";
import type { SlotAction, WarehouseSlot } from "@/lib/warehouse-types";

type WarehouseSlotPanelProps = {
  slot: WarehouseSlot | null;
  onAction: (action: SlotAction) => void;
  onClose: () => void;
};

function formatTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const ACTION_BUTTONS: Array<{
  action: SlotAction;
  label: (slot: WarehouseSlot) => string;
  variant?: "default" | "outline" | "secondary";
  disabled?: (slot: WarehouseSlot) => boolean;
}> = [
  {
    action: "restock",
    label: () => "一键补货",
    disabled: (slot) => slot.locked || slot.status === "reserved",
  },
  {
    action: "clear",
    label: () => "清空货位",
    variant: "outline",
    disabled: (slot) => slot.locked || slot.status === "empty",
  },
  {
    action: "toggle-lock",
    label: (slot) => (slot.locked ? "解锁货位" : "锁定货位"),
    variant: "secondary",
  },
  {
    action: "reserve",
    label: (slot) => (slot.status === "reserved" ? "取消预留" : "标记预留"),
    variant: "outline",
    disabled: (slot) => slot.locked,
  },
  {
    action: "mark-warning",
    label: (slot) => (slot.status === "warning" ? "解除异常" : "标记异常"),
    variant: "outline",
    disabled: (slot) => slot.locked || slot.status === "empty",
  },
];

export function WarehouseSlotPanel({ slot, onAction, onClose }: WarehouseSlotPanelProps) {
  const [flashingAction, setFlashingAction] = useState<SlotAction | null>(null);

  const handleAction = useCallback(
    (action: SlotAction) => {
      setFlashingAction(action);
      onAction(action);
      window.setTimeout(() => setFlashingAction(null), 560);
    },
    [onAction],
  );

  if (!slot) {
    return (
      <section className="flex min-h-[280px] flex-col items-center justify-center rounded-3xl border border-dashed border-cyan-200/15 bg-slate-950/50 p-6 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xl">
          📦
        </div>
        <p className="text-sm text-slate-300">点击 3D 场景中的彩色货位</p>
        <p className="mt-1 text-xs text-slate-500">选中后可在此面板执行补货、清空、锁定等操作，场景会同步播放动画</p>
      </section>
    );
  }

  const fillPercent = slot.capacity > 0 ? Math.round((slot.quantity / slot.capacity) * 100) : 0;

  return (
    <section key={slot.id} className="wh-panel-in grid gap-4 rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300/70">货位详情</p>
          <h2 className="mt-1 text-xl font-semibold text-white">{slot.id}</h2>
          <p className="mt-1 text-sm text-slate-400">
            巷道 {slot.aisle} · 第 {slot.bay} 列 · {slot.level} 层 · {slot.side === "left" ? "左侧" : "右侧"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
            {SLOT_STATUS_LABELS[slot.status]}
          </span>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="关闭货位详情">
            关闭
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-400">商品信息</p>
          <p className="mt-1 font-medium text-slate-100">{slot.productName ?? "— 空闲货位 —"}</p>
          <p className="mt-1 text-xs text-slate-500">SKU：{slot.sku ?? "无"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-400">库存量</p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {slot.quantity}
            <span className="ml-1 text-sm font-normal text-slate-400">
              / {slot.capacity} {slot.unit}
            </span>
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-cyan-400 transition-all duration-500 ease-out"
              style={{ width: `${Math.min(100, fillPercent)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">占用率 {fillPercent}%</p>
        </div>
      </div>

      <p className="text-xs text-slate-500">最近更新：{formatTime(slot.lastUpdated)}</p>

      <div className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">一键操作</p>
        <div className="flex flex-wrap gap-2">
          {ACTION_BUTTONS.map(({ action, label, variant, disabled }) => {
            const isFlashing = flashingAction === action;
            return (
              <Button
                key={action}
                variant={variant}
                className={isFlashing ? "wh-btn-flash" : undefined}
                onClick={() => handleAction(action)}
                disabled={disabled?.(slot)}
              >
                {label(slot)}
              </Button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
