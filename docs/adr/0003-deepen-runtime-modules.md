# ADR 0003: Deepen Runtime Modules

## Status

Accepted

## Context

Several runtime rules were previously repeated across Web, overlay, server, and
diagnostic code:

- Event-to-state and vibe behavior.
- Work context and companion speech.
- Overlay visibility and placement facts.
- Google structured output request and fallback behavior.
- Companion Console network aggregation.

Repeated rules made callers learn too much about implementation details.

## Decision

Keep these modules deep:

- `companion work interpretation`: one interface for state, vibe, reaction,
  light tone, work context, and brain reaction.
- `placement policy`: one interface for foreground visibility, placement mode,
  avoid regions, and chosen bounds.
- `structured AI provider adapter`: one interface for Google JSON requests,
  text extraction, fallback requests, and provider URLs.
- `Companion Console workflow`: one interface for loading status, session
  summary, event stream, and latest AI decision.

## Consequences

- UI adapters should render behavior packets instead of re-deriving behavior.
- Placement diagnostic should use the same placement policy as the live overlay.
- Provider-specific request mechanics should stay out of task modules such as
  classifier and Vision context.
- Future tests should target these interfaces first.
