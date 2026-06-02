# Browser Features Demo App

Purpose: Demonstrates the RealTesting browser-features emulator for fullscreen, popup, and clipboard flows while preserving standard browser semantics. Used as a smoke and E2E target for deterministic browser-UI behavior.

## Main Behaviors to Test
- Fullscreen requests succeed or fail according to configured gesture/test-mode requirements.
- `window.open` / popup flows remain deterministic in test mode.
- Clipboard reads/writes behave predictably without requiring real browser prompts in CI.
- Test-only behavior remains explicitly gated behind RealTesting enablement.

## Code Review Criteria

When reviewing changes in this app:

- Also follow the project-level criteria in `../../README.md`.
- Review fullscreen, popup, clipboard, and user-gesture handling as one browser-behavior contract.
- Preserve explicit test enablement and native-browser-like semantics; avoid demo-only shortcuts that would hide integration risk.

Required validation for review sign-off:

- Relevant RealTesting tests for touched browser-features behavior
- Demo smoke verification covering fullscreen, popup, and clipboard flows in deterministic test mode

High-risk regressions:

- browser-feature behavior no longer matching documented native semantics
- gesture gating bypassed or required unexpectedly
- hidden CI-only behavior that does not reflect real application integration
