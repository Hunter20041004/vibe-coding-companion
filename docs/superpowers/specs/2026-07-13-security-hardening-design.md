# Vibe Coding Companion Security Hardening Design

## Context

The companion's event service correctly binds to `127.0.0.1`, but it returns wildcard CORS headers and performs no browser-origin validation. A malicious website can therefore read session information, submit events, change overlay settings, invoke vision analysis, or overwrite the locally stored Google AI key configuration through the user's browser.

The service also supports trusted non-browser clients: Codex and Claude hooks, CLI emitters, prompt capture, the Electron overlay, and the local Vite dashboard. Hardening must preserve all of them.

## Goals

- Reject cross-site browser requests before any endpoint side effect.
- Return CORS headers only for explicitly allowed loopback dashboard origins.
- Validate the Host boundary to reduce DNS-rebinding exposure.
- Keep trusted loopback CLI/hook clients working without a new token-distribution system.
- Preserve every current endpoint and response contract for authorized local clients.

## Non-goals

- Exposing the event server to a LAN or remote network.
- Building user accounts or cloud synchronization.
- Changing event semantics, AI classification, overlay behavior, or hook formats.

## Design

### Browser request gate

`createLocalEventServer` will receive an allowlist whose defaults are the documented dashboard origins (`http://127.0.0.1:5173` and `http://localhost:5173`). For requests containing an `Origin` header, the server will require an exact match before routing. Disallowed origins, including `null`, will receive 403 and no permissive CORS header.

Preflight responses will echo only the validated origin, add `Vary: Origin`, and expose only the methods and headers the local UI needs. Wildcard origin responses will be removed.

### Host and non-browser clients

The server will accept only loopback Host values for its actual listening port. CLI and hook requests normally omit `Origin`; they remain authorized because they already connect to the loopback-bound server and pass the Host check. Electron content loads from the loopback Vite origin and follows the same browser allowlist.

The service will continue binding to `127.0.0.1`; no configuration will widen it to `0.0.0.0`.

### Errors and logging

- Invalid Host: 403 with `invalid_host`.
- Disallowed browser origin: 403 with `origin_not_allowed`.
- Allowed preflight: 204 with a specific origin and `Vary: Origin`.
- No API keys, prompt drafts, event bodies, or full session summaries will be added to security logs.

## Data flow

1. The Node HTTP server receives a loopback request.
2. Host validation confirms the request targets localhost/loopback.
3. If the browser supplied `Origin`, exact allowlist validation runs.
4. Only then does the existing endpoint router read bodies or call settings, AI, vision, event, or diagnostic handlers.
5. Authorized responses contain origin-specific CORS headers; non-browser local clients receive normal JSON responses.

## Testing strategy

Changes follow independent Red → Green → Refactor slices:

1. Add a failing test proving `https://evil.example` cannot read `/events`; implement exact origin rejection.
2. Add a failing mutation test proving a disallowed origin cannot write `/settings/google-ai-key`; verify the writer is never called.
3. Add a failing preflight test that expects the allowed origin to be echoed without `*`; implement scoped CORS headers.
4. Add a failing invalid-Host test; implement loopback Host validation.
5. Add/retain positive tests for the Vite dashboard origin, Electron loopback origin, CLI event POST, hook event POST, event polling, vision context, overlay settings, and setup-key flow.
6. Run Vitest, Playwright, production build, `npm audit`, a malicious-origin HTTP smoke test, and a normal `npm run dev:all` smoke test.

## Portfolio documentation

The README will explain why a loopback service still needs browser origin and Host checks, list the trusted local clients, and provide verification commands. This makes the threat model and the intentionally local architecture visible to interviewers.

## Acceptance criteria

- No response uses `Access-Control-Allow-Origin: *`.
- A disallowed browser origin cannot read or mutate any event-server endpoint.
- Invalid Host requests fail before route handlers run.
- Dashboard, setup page, Electron overlay, CLI emitters, and Codex/Claude hooks continue to pass their existing tests.
- Full tests, E2E tests, build, and dependency audit succeed.
