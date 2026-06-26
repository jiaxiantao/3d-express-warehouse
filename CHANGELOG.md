# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- 扫码定位：扫描商品 SKU 二维码（或手动输入）自动选中 3D 货位；货位面板展示商品定位码。
- 支持 URL `?sku=SKU-1001` 深链入口，兼容 `3dew:sku:` 短码与货位码。
- 每个货位仅在巷道正面中心贴一张货位号标签（与 `slot.id` 一致，如 `B-04-L4`）。

### Changed

- 货位材质改为 `MeshStandardMaterial` 并优化仓库三点布光 + 顶灯阴影，增强货位与货架立体感。
- 状态筛选保留未匹配货位半透明效果（独立 mesh 批次），匹配货位仍用 InstancedMesh 高亮。
- 货位批次 `useFrame` 仅在补货动画或首屏引导时刷新，空闲时不再每帧重绘矩阵。
- 选中描边尊重 `prefers-reduced-motion`（静态描边，无流动动画）。
- 统计卡片支持点击筛选（空闲 / 低库存 / 异常），筛选芯片增加 `aria-pressed`。
- 移动端选中货位后自动滚动至详情面板；URL `slot` 参数校验格式与存在性。
- 截图启用 `preserveDrawingBuffer`，提升 demand 渲染模式下导出成功率。

### Fixed

- `computeWarehouseStats` 在库数与利用率统一按 `quantity > 0` 计算。
- 空货位补货时自动填充 SKU 与商品名称。

## [1.0.0] - 2026-06-24

### Added

- 3D warehouse visualization with procedural rack layout and instanced slot meshes.
- Slot status color mapping (empty, occupied, low stock, full, warning, reserved, locked).
- Stats dashboard, status filter with transparent dimming, and slot detail panel with one-click actions.
- Flowing status-aware selection outline on slot edges.
- Multi-view camera presets (overview / aisle / top), screenshot, and fullscreen.
- URL deep-link sync for selected slot, view mode, and filter.
- Demo data layer in `src/lib/warehouse-data.ts` (WMS integration entry point).
- Docker / standalone Next.js deployment, GitHub Actions CI, and GitHub Pages demo (`docs/`).
- Open-source community files: `SUPPORT.md`, `GOVERNANCE.md`, issue templates, `CODEOWNERS`.

[Unreleased]: https://github.com/jiaxiantao/3d-express-warehouse/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/jiaxiantao/3d-express-warehouse/releases/tag/v1.0.0
