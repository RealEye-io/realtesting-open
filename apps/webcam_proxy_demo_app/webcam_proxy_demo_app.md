# Webcam Proxy Demo App

Purpose: Shows RealCamera operating in transparent proxy mode. Users can select physical or virtual
cameras, inspect device metadata, and verify constraint handling (resolution, fps).

Key behaviors to test:
- enumerateDevices lists virtual cameras.
- getUserMedia routes to physical or virtual streams correctly.
- Constraint changes apply to the active stream.

Notes:
- Demo creates two virtual devices and toggles physical device availability.
- Devtools panel allows changing virtual constraints, swapping sources, and simulating disconnects.

Devtools access:
- Toolbar is hidden by default. Enable via `?devtools=1` or `localStorage.setItem("realcamera.devtools", "1")`.
- Separate page: `devtools.html` (always shows the devtools panel).

## Code Review Criteria

When reviewing changes in this app:

- Also follow the project-level criteria in `../../README.md`.
- Review transparent proxy behavior, device enumeration, constraint handling, and devtools gating together.
- Preserve the distinction between default end-user behavior and explicitly enabled debugging/devtools behavior.

Required validation for review sign-off:

- Relevant RealTesting tests for touched proxy/device-selection behavior
- Demo smoke verification covering enumerateDevices, getUserMedia routing, and constraint updates

High-risk regressions:

- devtools exposed by default
- virtual/physical device routing drift
- constraint updates no longer affecting the active stream as documented

## Code Review Criteria

When reviewing changes in this app:

- Also follow the project-level criteria in `../../README.md`.
- Review transparent proxy behavior, device enumeration, constraint handling, and devtools gating together.
- Preserve the distinction between default end-user behavior and explicitly enabled debugging/devtools behavior.

Required validation for review sign-off:

- Relevant RealTesting tests for touched proxy/device-selection behavior
- Demo smoke verification covering enumerateDevices, getUserMedia routing, and constraint updates

High-risk regressions:

- devtools exposed by default
- virtual/physical device routing drift
- constraint updates no longer affecting the active stream as documented
