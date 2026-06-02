# RealTesting - AI Agent Instructions

Version 1.0.0

Project documentation lives in `README.md`.

## Scope
- Follow `README.md` as the single source of truth for architecture and decisions.

## Tech Stack
- TypeScript-first library with ESM/CJS outputs (built via `tsup`).
- Vite for demo apps; Vitest for unit tests; Playwright for E2E tests.
- Node.js 18+.
- Workspace monorepo: `packages/*` (libraries), `apps/*` (demos).

## Workspace Structure
- **`packages/*`** — Library packages. Built with `tsup` (esm + cjs + dts). `dist/` is committed.
  - `screen_capture`, `browser_features`, `realcamera`, `webrtc`, `websocket`
- **`apps/*`** — Demo apps. Each uses a fixed port (4173–4178) and calls only standard browser APIs.
- **`tests/*`** — E2E tests (Playwright). Unit tests are co-located near source where needed.

## Conventions
- **Proxy-style wrappers** — Emulators install via `.install()` and patch standard APIs. Preserve native signatures.
- **Native objects** — Always return native browser objects where feasible (`MediaStream`, `MediaStreamTrack`).
- **Test mode** — Enable via `?realtestingTest=1` or window globals (`window.__realtestingTestApi`, etc.).
- **Committed dist** — When package source changes, run `npm run build` then `npm run verify:dist` before committing.

## Compatibility Rules
- Preserve standard browser API semantics where feasible (Screen Capture, MediaDevices, WebRTC, WebSocket).
- Do not attempt to bypass OS/browser security models for native screen capture.
  - Virtual capture exists only when explicitly enabled/configured (tests).
- For WebSocket/WebRTC: do not introduce real network dependencies into CI-focused E2E tests.

## Testing
- Add or update tests for any new behavior.
- Prefer deterministic, virtual-stream driven E2E tests (CI-friendly).
- Do not require interactive browser prompts in CI.
- Use timing profiles (`ciRealistic` / `realistic`) only for enforcement of async behavior.

## Validation Checklist
Before proposing changes, ensure:
- `npm test` passes (unit + E2E).
- `npm run build` + `npm run verify:dist` pass when package source changed.
- Relevant demo app smoke validation for touched emulator surfaces.
