# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| `main` (latest) | Yes |
| Tagged releases | Security fixes on best effort |
| Older tags | Not supported |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead:

1. Use [GitHub Private Vulnerability Reporting](https://github.com/jiaxiantao/3d-express-warehouse/security/advisories/new) if available for this repository, **or**
2. Open a minimal issue asking the maintainer for a private contact channel **without** including exploit details.

Include:

- Affected component (e.g. Next.js route, client bundle, Docker image, dependency)
- Steps to reproduce
- Impact assessment (if known)

We aim to acknowledge reports within **7 days** and provide a fix or mitigation plan when possible.

## Scope

In scope:

- This application's source code and default Docker configuration
- Dependency vulnerabilities reachable through this app's usage
- Leakage of secrets via misconfiguration documented in this repo

Out of scope:

- Vulnerabilities in upstream browser WebGL / GPU drivers without a practical app-specific exploit
- Self-hosted deployments with custom env vars or reverse proxies not maintained in this repository

## Safe defaults

- Do not commit `.env` files, API keys, or WMS credentials.
- Run `pnpm install` only from this repository's lockfile in CI and production builds.
- Treat demo data in `warehouse-data.ts` as non-production; wire real WMS endpoints behind your own auth.
