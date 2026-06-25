/** 构建可被扫码识别的货位定位 URL（含 GitHub Pages basePath） */
export function getWarehouseAppBase(): string {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_SITE_URL ?? "https://jiaxiantao.github.io/3d-express-warehouse");
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${origin}${basePath}`;
}

export function buildSkuLocateUrl(sku: string): string {
  return `${getWarehouseAppBase()}/warehouse?sku=${encodeURIComponent(sku)}`;
}

export function buildSlotLocateUrl(slotId: string): string {
  return `${getWarehouseAppBase()}/warehouse?slot=${encodeURIComponent(slotId)}`;
}

/** 商品标签上的短码，便于非 URL 二维码 */
export function buildSkuScanCode(sku: string): string {
  return `3dew:sku:${sku}`;
}
