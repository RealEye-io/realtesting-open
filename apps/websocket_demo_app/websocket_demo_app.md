# WebSocket Demo App

Purpose: Demonstrates the RealTesting WebSocket emulator with a deterministic in-memory echo server. Used as a CI-friendly smoke and E2E target for browser WebSocket flows without real network dependencies.

## Main Behaviors to Test
- WebSocket connections open, exchange messages, and close deterministically.
- Echo-server behavior remains predictable for automated tests.
- Error and close handling continue to mirror expected browser usage patterns.
- Test-only behavior remains explicitly gated and does not require real network services.

## Code Review Criteria

When reviewing changes in this app:

- Also follow the project-level criteria in `../../README.md`.
- Review connection lifecycle, message ordering, and error/close semantics together.
- Preserve the no-real-network rule for CI-focused validation.

Required validation for review sign-off:

- Relevant RealTesting tests for touched WebSocket behavior
- Demo smoke or E2E verification covering connect/send/receive/close flows

High-risk regressions:

- new reliance on external network infrastructure
- non-deterministic message ordering or close behavior
- WebSocket semantics drifting away from documented browser-compatible behavior
