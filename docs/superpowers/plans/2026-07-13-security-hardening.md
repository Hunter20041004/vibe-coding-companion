# Vibe Coding Companion Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent cross-site browser access and DNS-rebinding requests without breaking trusted loopback clients.

**Architecture:** Add a request-boundary policy inside `createLocalEventServer` before routing. Browser origins are exact-matched; Host is restricted to localhost/loopback; origin-specific CORS headers are returned only after authorization.

**Tech Stack:** Node.js HTTP, Vitest, Vite, Electron, Playwright.

## Global Constraints

- Modify only the GitHub clone/worktree under the Codex workspace; never touch the user's original local project.
- Follow one Red → Green → Refactor slice at a time.
- Preserve every existing endpoint and non-browser loopback client contract.

---

### Task 1: Reject disallowed browser origins

**Files:**
- Modify: `tests/local-event-server.test.js`
- Modify: `src/local-event-server.js`

**Interfaces:**
- Consumes: Node `IncomingMessage.headers.origin`.
- Produces: `isAllowedOrigin(origin, allowedOrigins): boolean` and an early 403 response.

- [ ] **Step 1: Write the failing read-boundary test**

Add a test that starts `createLocalEventServer()`, posts one event from a trusted non-browser client, then requests `GET /events` with `Origin: https://evil.example`. Assert status 403, body `{ error: "origin_not_allowed" }`, and no `access-control-allow-origin` header.

- [ ] **Step 2: Run the focused test and verify Red**

Run: `npm test -- --run tests/local-event-server.test.js -t "rejects disallowed browser origins"`

Expected: FAIL because the current server returns 200 and `*`.

- [ ] **Step 3: Implement the minimal origin gate**

Add defaults:

```js
const DEFAULT_ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);
```

Accept `allowedOrigins = DEFAULT_ALLOWED_ORIGINS` in `createLocalEventServer`; before OPTIONS or routing, reject any present origin that is not an exact member. Do not set CORS headers before the check.

- [ ] **Step 4: Verify Green and refactor**

Run the focused test, then the full `tests/local-event-server.test.js` file. Extract a small `isAllowedOrigin` helper only after Green.

- [ ] **Step 5: Commit**

Commit: `fix: reject cross-site event server requests`

### Task 2: Scope CORS and block dangerous mutations

**Files:**
- Modify: `tests/local-event-server.test.js`
- Modify: `src/local-event-server.js`

**Interfaces:**
- Produces: `setCorsHeaders(response, origin)` that echoes an authorized origin and sets `Vary: Origin`.

- [ ] **Step 1: Write the failing mutation test**

Call `POST /settings/google-ai-key` with `Origin: https://evil.example` and an injected `saveGoogleAiStudioKey` spy. Assert 403 and that the spy has zero calls.

- [ ] **Step 2: Verify Red**

Run the one test; it must fail because the current wildcard policy reaches the writer.

- [ ] **Step 3: Implement minimal route-before-body protection**

Reuse the origin gate before `readJson`. For allowed origins, set:

```js
response.setHeader("access-control-allow-origin", origin);
response.setHeader("vary", "Origin");
response.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
response.setHeader("access-control-allow-headers", "content-type");
```

Do not emit `Access-Control-Allow-Origin` for requests without Origin.

- [ ] **Step 4: Add and pass allowed preflight test**

Test `OPTIONS /events` with `Origin: http://127.0.0.1:5173`; expect 204, the exact origin, `Vary: Origin`, DELETE allowed, and no wildcard.

- [ ] **Step 5: Commit**

Commit: `fix: scope local event server CORS`

### Task 3: Validate Host without breaking loopback clients

**Files:**
- Modify: `package.json`
- Modify: `tests/local-event-server.test.js`
- Modify: `src/local-event-server.js`
- Modify: `README.md`

**Interfaces:**
- Produces: `isLoopbackHost(hostHeader): boolean`, accepting `127.0.0.1`, `localhost`, and `[::1]` with optional numeric ports.

- [ ] **Step 1: Write failing invalid-Host test**

Send `Host: attacker.example` to `/healthz`; expect 403 `{ error: "invalid_host" }`.

- [ ] **Step 2: Verify Red, implement regex-free URL parsing, verify Green**

Parse the header with `new URL('http://' + host)` and compare `hostname` to an allowlist. Reject malformed values. Run the focused test.

- [ ] **Step 3: Prove trusted clients still work**

Add positive assertions for `127.0.0.1`, `localhost`, a non-browser event POST, setup-key mutation from the Vite origin, and normal event polling.

- [ ] **Step 4: Document the threat model**

Add a README `Security design` section describing loopback binding, Host validation, exact browser-origin allowlisting, and the fact that keys/prompts are not logged.

- [ ] **Step 5: Add a production build command, run complete verification, and commit**

Add `"build": "vite build"` to `package.json`, then run: `npm test`, `npm run test:e2e`, `npm run build`, and `npm audit --audit-level=high`.

Commit: `docs: explain local service security boundary`
