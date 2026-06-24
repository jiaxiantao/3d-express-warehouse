# Contributing

Thank you for considering a contribution to **3D Express Warehouse** (`3d-express-warehouse`)!

## Before you start

- Search [existing issues](https://github.com/jiaxiantao/3d-express-warehouse/issues) to avoid duplicates.
- For large changes (new WMS integration, multi-warehouse layouts, breaking APIs), open an issue first to align on scope.
- Read [documentation/ARCHITECTURE.md](documentation/ARCHITECTURE.md) when touching warehouse data or 3D layout code.
- Do **not** commit secrets (`.env`, API keys, WMS tokens). `.env.example` documents public variables only.

## Development setup

Requirements: **Node.js 20+**, **pnpm 9+** (see `.nvmrc` and `package.json` `engines`).

```bash
git clone https://github.com/jiaxiantao/3d-express-warehouse.git
cd 3d-express-warehouse
pnpm install
cp .env.example .env   # optional
pnpm dev
```

Open [http://localhost:3100/warehouse](http://localhost:3100/warehouse) for the 3D view.

## Quality checks (required before PR)

```bash
pnpm lint
pnpm typecheck
pnpm build
```

CI runs the same steps on every push to `main` and on pull requests.

## Branch & commit conventions

- Branch from `main`: `feat/short-description`, `fix/short-description`, or `docs/short-description`.
- Use clear commit messages (English or 中文), e.g. `feat: add slot heatmap overlay`.
- Keep PRs focused; split unrelated changes when possible.

## Pull request guidelines

1. Fill in the [PR template](.github/PULL_REQUEST_TEMPLATE.md).
2. **Describe** what changed and why; include screenshots or screen recordings for UI/3D changes.
3. **Update docs** if you change URLs, env vars, warehouse layout, or data contracts.
4. **Avoid** unrelated formatting churn across the repo.
5. By opening a PR, you agree your contribution is licensed under the [MIT License](LICENSE).

## Code style

- TypeScript strict mode; match existing naming and file layout.
- Prefer `useMemo` / `useCallback` over effects that only sync derived state (React 19 ESLint rules).
- Three.js scene mutations inside R3F are intentional; use targeted `eslint-disable-next-line` with a short comment when required.

## Reporting bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml). Include:

- Browser & OS
- Steps to reproduce
- Console errors or screenshots if applicable

## Questions

Use the [question template](.github/ISSUE_TEMPLATE/question.yml) or read [SUPPORT.md](SUPPORT.md).

## Community standards

By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).
Project governance is described in [GOVERNANCE.md](GOVERNANCE.md).
