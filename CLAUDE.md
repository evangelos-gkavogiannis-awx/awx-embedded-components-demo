# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies (run from repo root)
pnpm install

# Start the app (builds frontend, then serves on http://localhost:3000)
pnpm start

# Build frontend only
pnpm build

# Frontend dev server (hot-reload, no backend)
pnpm --filter frontend dev
```

`pnpm start` runs `backend/src/start.js`, which:
1. Runs `pnpm install`
2. Starts `vite build --watch` (waits for first build before continuing)
3. Starts Express with `--watch` (auto-restarts on backend changes)

Frontend changes are picked up on browser refresh; backend changes restart Express automatically. No manual restart needed.

## Architecture

This is a pnpm monorepo (`pnpm-workspace.yaml`) with two packages:

- **`backend/`** — Express server (ESM, Node 18+). Proxies all calls to `https://api-demo.airwallex.com`. Handles auth token lifecycle: fetches tokens via `POST /api/v1/authentication/login`, caches them in-memory per `clientId` with a 1-minute expiry buffer, and refreshes automatically.

- **`frontend/`** — React 18 + Vite SPA. Mounts Airwallex embedded components via `@airwallex/components-sdk`. All inline styles (no CSS files or CSS-in-JS library).

The backend serves the built frontend from `frontend/dist` as static files. The Express SPA catch-all (`app.get('*', ...)`) must remain last. `backend/src/proxy-bootstrap.js` is system-managed — do not modify or remove it.

## Key Patterns

**Adding a backend API route:** Add it in `backend/src/server.js` below the `// ── API routes ──` comment. Never change the PORT setup or the static-file middleware block at the bottom.

**Frontend API calls must always use the `BASE` prefix:**
```js
const BASE = window.__API_BASE__ || '';
fetch(BASE + '/api/your-endpoint')
```

**Airwallex SDK initialization flow** (followed by every component):
1. Call `/api/get-auth-code` (backend handles PKCE: generates `codeVerifier` + `codeChallenge`, calls `/api/v1/authentication/authorize`)
2. Call `init({ authCode, codeVerifier, env: 'demo', enabledElements, clientId })`
3. Call `createElement(elementType, options?)` → attach event listeners → `element.mount(containerRef.current)`
4. Clean up with `element.unmount()` in a `useEffect` return

**Layout constants** (`frontend/src/embeddedComponentLayout.js`): `EMBEDDED_COMPONENT_MAX_WIDTH` and `EMBEDDED_COMPONENT_HEIGHT` control iframe sizing for all components. The `.awx-embedded-mount iframe` CSS override (exported as `embeddedIframeStyles`) must be injected via a `<style>` tag in each component.

**SCA flow specifics:** `GET /api/get-balance` may return `{ code: 'sca_token_missing', sca_session_code }` instead of balance data. The frontend then mounts `scaVerify` element; on `verificationSucceed`, calls `/api/get-balance-verified` with the `scaToken`.

## Scopes by Component

| Component | SDK `enabledElements` | Required scopes |
|-----------|----------------------|----------------|
| KYC | `['onboarding']` | `w:awx_action:onboarding` |
| KYC RFI | `['onboarding']` | `w:awx_action:onboarding` |
| Beneficiary | `['payment']` | `w:awx_action:beneficiary_create` |
| Transfer | `['payment']` | `w:awx_action:transfer_create` |
| SCA | `['risk']` | `w:awx_action:sca_edit`, `r:awx_action:sca_view` |
