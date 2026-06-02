# WebRTC Demo App

Purpose: Demonstrates the RealTesting WebRTC emulator with deterministic in-memory `RTCPeerConnection` behavior and negotiated `RTCDataChannel` flows. Used as a CI-friendly validation target for hosted-session style messaging.

## Main Behaviors to Test
- Peer connection setup completes deterministically without real network infrastructure.
- Data channels open, exchange messages, and close using expected browser semantics.
- Test mode stays explicit and does not introduce hidden external connectivity.
- Timing/async behavior remains realistic enough to exercise application logic correctly.

## Code Review Criteria

When reviewing changes in this app:

- Also follow the project-level criteria in `../../README.md`.
- Review signaling/setup timing, connection lifecycle, and data-channel semantics together.
- Preserve the no-real-network rule for CI-focused validation.

Required validation for review sign-off:

- Relevant RealTesting tests for touched WebRTC behavior
- Demo smoke or E2E verification covering connection establishment and data-channel messaging

High-risk regressions:

- accidental dependence on real network services
- non-deterministic connection behavior in CI
- broken native-like `RTCPeerConnection` or `RTCDataChannel` semantics
