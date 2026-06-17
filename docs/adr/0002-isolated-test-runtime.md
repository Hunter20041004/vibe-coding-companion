# ADR 0002: Isolated Test Runtime

## Status

Accepted

## Context

Daily use can leave a background companion runtime listening on fixed ports
`5173` and `5174`. Playwright previously allowed reuse of existing servers on
those ports, which made E2E tests capable of attaching to a stale or unrelated
runtime.

## Decision

Playwright E2E uses isolated ports:

- Web app: `http://127.0.0.1:5183`
- Event server: `http://127.0.0.1:5184`

The E2E web servers do not reuse existing servers. The Vite app receives
`VITE_COMPANION_EVENT_URL=http://127.0.0.1:5184/events`, and CLI event tests set
`EVENT_URL` to the same endpoint.

## Consequences

- E2E tests verify the code under test instead of a user's background runtime.
- Daily use can keep using `5173` and `5174`.
- `npm run verify` is safe to run while a daily companion runtime exists.
