# Face Detection Demo App

Purpose: Demonstrates RealCamera virtual webcam streams by running MediaPipe Face Detector in-browser
and reporting detection confidence, bounding boxes, and fps metrics. Used as an E2E validation target.

Key behaviors to test:
- Virtual camera frame delivery and stability.
- Face detection outputs on known fixtures.
- Device switching without reload.

Assets:
- Face fixture: `public/fixtures/face.jpg`
- Model: loaded at runtime from MediaPipe CDN (see `face-demo.ts`).
- MediaPipe WASM: loaded at runtime from CDN (see `face-demo.ts`).

Caching:
- Run `npm run assets:mediapipe` from `projects/realtesting` to cache the WASM and model in
  `~/.cache/realcamera/mediapipe/<version>/`.
- The dev server serves cached assets at `/mediapipe` and `/models` to avoid repeat downloads.

## Code Review Criteria

When reviewing changes in this app:

- Also follow the project-level criteria in `../../README.md`.
- Treat this demo as an E2E validation target for RealCamera plus face detection, not just a UI sample.
- Preserve virtual-camera stability, fixture behavior, MediaPipe asset loading, and device switching semantics.

Required validation for review sign-off:

- Relevant RealTesting unit/E2E coverage for touched camera or detection behavior
- Demo smoke verification that face detection still works on the known fixture and virtual stream

High-risk regressions:

- unstable virtual frame delivery
- broken MediaPipe asset loading/caching
- device-switch behavior that now requires reloads or user intervention

## Code Review Criteria

When reviewing changes in this app:

- Also follow the project-level criteria in `../../README.md`.
- Treat this demo as an E2E validation target for RealCamera plus face detection, not just a UI sample.
- Preserve virtual-camera stability, fixture behavior, MediaPipe asset loading, and device switching semantics.

Required validation for review sign-off:

- Relevant RealTesting unit/E2E coverage for touched camera or detection behavior
- Demo smoke verification that face detection still works on the known fixture and virtual stream

High-risk regressions:

- unstable virtual frame delivery
- broken MediaPipe asset loading/caching
- device-switch behavior that now requires reloads or user intervention
