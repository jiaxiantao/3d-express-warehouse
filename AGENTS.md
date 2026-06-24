# 3D Express Warehouse — agent context

Open-source **3D warehouse / WMS visualization** (Next.js + React Three Fiber + Three.js).

- **Scope:** warehouse / WMS visualization only — procedural racks, instanced slot meshes, status filters.
- Main UI: `src/app/warehouse/page.tsx`; WebGL scene: `src/components/warehouse-scene.tsx`.
- Single layout source: `src/lib/warehouse-layout.ts`; demo data: `src/lib/warehouse-data.ts`.
- Dev server: `pnpm dev` → http://localhost:3100/warehouse
- GitHub Pages export: `pnpm build:pages` → `docs/`

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
