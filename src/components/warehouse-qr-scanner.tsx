"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type WarehouseQrScannerProps = {
  onClose: () => void;
  onScan: (raw: string) => void;
};

export function WarehouseQrScanner({ onClose, onScan }: WarehouseQrScannerProps) {
  const regionId = useId().replace(/:/g, "");
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) {
      return;
    }
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch {
      // ignore stop errors
    }
    scanner.clear();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const startScanner = async () => {
      setStarting(true);
      setCameraError(null);
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) {
          return;
        }

        await stopScanner();
        const scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
          (decoded) => {
            void stopScanner();
            onScanRef.current(decoded);
          },
          () => {},
        );
      } catch {
        if (!cancelled) {
          setCameraError("无法打开摄像头，请授予相机权限，或使用下方手动输入 SKU / 货位码");
        }
      } finally {
        if (!cancelled) {
          setStarting(false);
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [regionId, stopScanner]);

  const handleManualSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = manualValue.trim();
    if (!value) {
      return;
    }
    void stopScanner();
    onScan(value);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="warehouse-qr-scanner-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 id="warehouse-qr-scanner-title" className="text-base font-semibold text-white">
              扫码定位货位
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">扫描商品 SKU 码，自动在 3D 仓库中高亮货位</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="关闭扫码">
            关闭
          </Button>
        </div>

        <div className="space-y-4 p-5">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
            <div id={regionId} className="min-h-[240px] w-full [&>video]:object-cover" />
            {starting ? (
              <p className="px-3 py-2 text-center text-xs text-slate-500">正在启动摄像头…</p>
            ) : null}
            {cameraError ? (
              <p className="px-3 py-2 text-center text-xs text-amber-300/90">{cameraError}</p>
            ) : null}
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label htmlFor="warehouse-scan-manual" className="text-xs text-slate-400">
              手动输入 SKU 或货位码（如 SKU-1001、A-01-L1）
            </label>
            <div className="flex gap-2">
              <input
                id="warehouse-scan-manual"
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                placeholder="SKU-1001"
                className="h-10 min-w-0 flex-1 rounded-full border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-200/30"
                autoComplete="off"
              />
              <Button type="submit" size="sm" className="shrink-0">
                定位
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
