"use client";

import { useEffect, useRef } from "react";

import { buildSkuLocateUrl } from "@/lib/warehouse-qr";

type WarehouseSlotQrProps = {
  sku: string;
  productName: string;
};

export function WarehouseSlotQr({ sku, productName }: WarehouseSlotQrProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let cancelled = false;

    import("qrcode").then((QRCode) => {
      if (cancelled) {
        return;
      }
      QRCode.toCanvas(canvas, buildSkuLocateUrl(sku), {
        width: 128,
        margin: 1,
        color: { dark: "#e2e8f0", light: "#00000000" },
      }).catch(() => {
        // ignore canvas errors in demo
      });
    });

    return () => {
      cancelled = true;
    };
  }, [sku]);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <canvas
        ref={canvasRef}
        className="shrink-0 rounded-lg border border-white/10 bg-slate-950/80 p-1"
        aria-hidden
      />
      <div className="min-w-0 text-xs text-slate-400">
        <p className="font-medium text-slate-200">商品定位码</p>
        <p className="mt-0.5 truncate">{productName}</p>
        <p className="mt-1 text-[11px] text-slate-500">扫码可定位至货位 {sku}</p>
      </div>
    </div>
  );
}
