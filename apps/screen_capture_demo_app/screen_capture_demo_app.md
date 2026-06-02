# Screen Capture Demo App

Purpose: Demonstrates the RealTesting screen-capture emulator for `navigator.mediaDevices.getDisplayMedia` and virtual display streams. Used as a deterministic smoke and E2E target for screen-recording flows.

## Main Behaviors to Test
- Virtual display capture is available only when explicitly enabled/configured.
- Returned display streams remain compatible with downstream browser APIs such as `MediaRecorder`.
- Optional audio behavior stays aligned with documented RealTesting semantics.
- CI/headless flows do not require interactive OS/browser permission prompts.

## Code Review Criteria

When reviewing changes in this app:

- Also follow the project-level criteria in `../../README.md`.
- Review `getDisplayMedia` semantics, virtual-permission handling, stream compatibility, and recording behavior together.
- Preserve the project rule that RealTesting must not pretend to bypass native capture security outside explicit test configuration.

Required validation for review sign-off:

- Relevant RealTesting tests for touched screen-capture behavior
- Demo smoke verification that virtual capture works and still integrates with screen-recording consumers

High-risk regressions:

- interactive permission requirements in CI
- returned streams no longer behaving like standard browser capture streams
- test-mode behavior leaking into default/native paths
