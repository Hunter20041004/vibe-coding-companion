# Vibe Coding Companion Context

## Product Shape

Vibe Coding Companion is a local coding companion runtime. It started as a Web
prototype for a pixel blob that reacts to a simulated bug-fix flow, but the
current product now includes:

- A Web companion prototype at `/`.
- A Companion Console at `/setup-key.html`.
- A local event server on `127.0.0.1`.
- Hook adapters for Codex and Claude Code.
- A transparent Electron desktop overlay.
- Optional AI decisions and one-shot Vision context.

The user value is focus-safe companionship during agentic coding work. The
companion should make local work state visible without competing with the coding
surface.

## Domain Terms

### Companion

The pixel blob character and its behavior model. The companion reacts to local
coding signals through state, vibe, motion, gesture, short speech, and placement.

### Companion Console

The local control surface at `/setup-key.html`. It handles AI key setup, server
status, session summary, next-step advice, Vision context, overlay calibration,
and placement diagnostics.

### Local Event Server

The local-only HTTP runtime that accepts observable coding events, stores a
short event stream in memory, exposes settings endpoints, and optionally appends
AI decision events.

### Hook Adapter

The provider-specific bridge from Codex or Claude Code hook payloads into the
companion event model. Hook adapters normalize external payload shapes into
events such as `prompt:submitted`, `tool:start`, `tool:finish`, and
`turn:complete`.

### Companion Work Interpretation

The module that turns local events into one behavior packet: state, vibe,
reaction metadata, light tone, work context, and brain reaction. Web, overlay,
and state trackers should depend on this interface instead of duplicating event
interpretation rules.

### Desktop Overlay

The transparent Electron window that follows Codex or Claude-like foreground
windows. It is click-through and should stay quiet: no full HUD, no progress
bars, no debug controls.

### Placement Policy

The module that decides whether the overlay is visible and where it belongs
inside the foreground coding window. It combines foreground app matching,
window bounds, safe zones, modeled no-fly regions, Accessibility no-fly regions,
overlay settings, and diagnostic reason codes.

### No-Fly Region

A rectangle inside the foreground window that the companion should avoid, such
as the central reading area, input composer, right-side panel, text area, scroll
area, web area, or useful Accessibility region.

### AI Decision

A structured event from an optional AI provider. It can refine companion state,
motion, intensity, speech line, skill hint, next-step advice, and Vision
placement safe zone. The system must keep deterministic behavior when AI is not
configured.

### Vision Context

A user-approved, one-shot screenshot analysis. It returns privacy-filtered
coding-workflow context and may publish an `ai:decision`. It is not continuous
screen watching.

## Current Quality Gate

Use:

```bash
npm run verify
```

This runs Vitest plus Playwright E2E. E2E must use isolated ports `5183` and
`5184` so it never attaches to a user's background companion runtime.

## Scope Notes

The PRD under `prd/` records the original prototype scope. The current runtime
has moved beyond that document. Treat this context file and the ADRs under
`docs/adr/` as the current architecture baseline until the PRD is updated.
