# 3D Express Warehouse · 3D 快递仓储可视化

[![CI](https://github.com/jiaxiantao/3d-express-warehouse/actions/workflows/ci.yml/badge.svg)](https://github.com/jiaxiantao/3d-express-warehouse/actions/workflows/ci.yml)
[![GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-0891b2)](https://jiaxiantao.github.io/3d-express-warehouse/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933)](package.json)

Open-source **3D warehouse visualization** for logistics and WMS demos. Built with **Next.js**, **React Three Fiber**, and **Three.js** — map slot status and inventory onto a procedural rack layout, filter by state, and manage slots in one click.

开源的 **3D 快递仓储可视化** 项目，适用于物流 / WMS 演示与二次开发：货位状态着色、库存展示、状态筛选高亮、一键补货 / 清空 / 锁定等操作。

**Live demo / 在线预览：** https://jiaxiantao.github.io/3d-express-warehouse/

---

## Table of contents

- [Features](#features)
- [Quick start](#quick-start)
- [Deployment](#deployment)
- [Project structure](#project-structure)
- [Integrating real WMS data](#integrating-real-wms-data)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Features

| Capability | Description |
|------------|-------------|
| **Status mapping** | Empty, in-stock, low stock, full, warning, reserved, locked — each with a distinct color |
| **At-a-glance stats** | Total slots, utilization, low-stock and warning counts |
| **Status filter** | Highlight matching slots; dim others with transparency |
| **Slot panel** | SKU, quantity, fill bar, one-click restock / clear / lock / reserve / mark warning |
| **Camera presets** | Overview, aisle, top-down; screenshot and fullscreen |
| **Deep links** | Selected slot, view mode, filter, and SKU scan entry (`?sku=`) sync to URL query params |
| **QR locate** | Scan product SKU QR to jump to the slot in 3D; panel shows locate QR per SKU |
| **Performance** | Instanced meshes grouped by status; Three.js loaded only on `/warehouse` |

## Quick start

### Requirements

- [Node.js](https://nodejs.org/) **20+**
- [pnpm](https://pnpm.io/) **9+**

### Install & develop

```bash
git clone https://github.com/jiaxiantao/3d-express-warehouse.git
cd 3d-express-warehouse
pnpm install
cp .env.example .env   # optional
pnpm dev
```

- App entry: http://localhost:3100  
- 3D warehouse: http://localhost:3100/warehouse  

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Development server (port 3100) |
| `pnpm build` | Production build (standalone) |
| `pnpm start` | Run standalone server |
| `pnpm build:pages` | Static export for GitHub Pages → `docs/` |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript check |

### Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for metadata | `http://localhost:3100` |

See [`.env.example`](.env.example). Never commit `.env`.

## Deployment

### GitHub Pages

Pushes to `main` trigger [`.github/workflows/pages.yml`](.github/workflows/pages.yml) (ignores `docs/**`-only commits). Static site is served from `/docs` at:

`https://<user>.github.io/3d-express-warehouse/`

Local preview:

```bash
pnpm build:pages
npx serve docs
# open http://localhost:3000/3d-express-warehouse/
```

### Docker

```bash
docker compose up --build
```

## Project structure

```
├── src/
│   ├── app/                    # Next.js App Router
│   │   └── warehouse/          # 3D console page
│   ├── components/
│   │   ├── warehouse-scene.tsx # R3F scene (racks, slots, interaction)
│   │   ├── warehouse-environment.tsx
│   │   ├── warehouse-slot-panel.tsx
│   │   ├── warehouse-stats-bar.tsx
│   │   └── warehouse-quick-actions.tsx
│   └── lib/
│       ├── warehouse-types.ts
│       ├── warehouse-data.ts   # Demo data & mutations (WMS hook)
│       ├── warehouse-layout.ts # Single source of 3D coordinates
│       └── warehouse-colors.ts
├── documentation/ARCHITECTURE.md
├── docs/                       # GitHub Pages static export (generated)
└── .github/workflows/          # CI & Pages deploy
```

## Integrating real WMS data

1. Align your API with `WarehouseSlot` in [`src/lib/warehouse-types.ts`](src/lib/warehouse-types.ts) (or add an adapter).
2. Replace `createWarehouseState()` in [`src/lib/warehouse-data.ts`](src/lib/warehouse-data.ts) with `GET /api/slots`.
3. Replace `applySlotAction()` with your WMS write APIs.
4. Optional: WebSocket push to update `slots` state in real time.

## Documentation

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](documentation/ARCHITECTURE.md) | Scene graph, state ownership, extension points |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |
| [SUPPORT.md](SUPPORT.md) | Where to get help |
| [SECURITY.md](SECURITY.md) | Vulnerability reporting |
| [GOVERNANCE.md](GOVERNANCE.md) | Maintainer model |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community standards |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

1. Fork the repository  
2. Create a feature branch (`feat/my-change`)  
3. Run `pnpm lint && pnpm typecheck && pnpm build`  
4. Open a pull request with screenshots for UI/3D changes  

Bug reports and feature requests: [open an issue](https://github.com/jiaxiantao/3d-express-warehouse/issues/new/choose).

## Tech stack

| Layer | Stack |
|-------|-------|
| Framework | Next.js 16 · React 19 |
| 3D | three · @react-three/fiber |
| Styling | Tailwind CSS 4 · TypeScript 5 |

## License

[MIT License](LICENSE) © [jiaxiantao](https://github.com/jiaxiantao)

You are free to use, modify, and distribute this project with attribution. See [LICENSE](LICENSE) for full terms.
