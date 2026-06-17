# ADR 0001: Local Companion Runtime

## Status

Accepted

## Context

The prototype originally described a browser-only companion. The implementation
now supports a local companion runtime: Vite Web app, local event server, hook
adapters, Companion Console, optional AI decisions, Vision context, and Electron
desktop overlay.

## Decision

Treat the product as a local companion runtime, not only a Web demo. The local
event server is the runtime seam for observable coding events and settings. The
desktop overlay and Web prototype are adapters over the same event stream.

## Consequences

- Local-only endpoints are product behavior and must stay tested.
- The runtime must work without AI credentials.
- AI and Vision must remain optional adapters.
- README and CONTEXT.md are the current source for daily usage behavior.
- The old PRD should be updated before using it for roadmap decisions.
