# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
