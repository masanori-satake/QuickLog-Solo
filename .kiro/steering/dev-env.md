---
inclusion: auto
---
# Dev Environment

## Prerequisites

- **Node.js 24** — JS test runner (Jest), linting (ESLint/Stylelint), build scripts
- **Python 3.x** — verification scripts, animation registry generation, icon generation

## Setup Commands

```bash
npm ci
npx playwright install --with-deps chromium
pip install pre-commit
pre-commit install
```

## Development Commands

```bash
npm test              # Unit tests (Jest + jsdom + fake-indexeddb)
npm run test:e2e      # E2E tests (Playwright + Chromium)
npm run lint          # ESLint + Stylelint
npm run build         # Extension package build (icons, registry, ZIP, Vite)
npm run dev           # Vite dev server (port 8080)
```

## Notes

- `npm run dev` starts Vite dev server on port 8080 — required before `npm run test:e2e`
- `generate_animation_registry.py` auto-runs via `npm test` and `npm run test:e2e` (no manual invocation needed)
- Verify environment: `python scripts/verify_dev_env.py`
