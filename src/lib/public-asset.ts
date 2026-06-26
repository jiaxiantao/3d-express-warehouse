/** public 目录资源 URL（兼容 GitHub Pages basePath） */
export function getPublicAssetUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
