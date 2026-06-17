export function createCompanionConsoleWorkflow({
  fetchImpl = globalThis.fetch,
  statusEndpoint = "http://127.0.0.1:5174/settings/status",
  eventsEndpoint = "http://127.0.0.1:5174/events",
  sessionSummaryEndpoint = "http://127.0.0.1:5174/session/summary",
} = {}) {
  async function fetchJson(url, options) {
    const response = await fetchImpl(url, options);
    if (!response.ok) throw new Error(`Request failed: ${url}`);
    return response.json();
  }

  async function loadStatus() {
    try {
      const payload = await fetchJson(statusEndpoint);
      return {
        server: payload.ok ? "online" : "offline",
        ai: payload.aiConfigured ? "configured" : "missing",
        model: payload.model ?? "not set",
        provider: payload.provider ?? null,
      };
    } catch {
      return {
        server: "offline",
        ai: "unknown",
        model: "unknown",
        provider: null,
      };
    }
  }

  async function fetchEvents() {
    return fetchJson(`${eventsEndpoint}?since=0`);
  }

  async function loadLatestDecision() {
    try {
      const payload = await fetchEvents();
      return [...(payload.events ?? [])]
        .reverse()
        .find((item) => item.event?.type === "ai:decision")?.event ?? null;
    } catch {
      return null;
    }
  }

  async function loadSessionSummary() {
    try {
      const payload = await fetchJson(sessionSummaryEndpoint);
      return payload.summary ?? null;
    } catch {
      return null;
    }
  }

  async function loadSnapshot() {
    const [status, sessionSummary, latestDecision] = await Promise.all([
      loadStatus(),
      loadSessionSummary(),
      loadLatestDecision(),
    ]);

    return {
      status,
      sessionSummary,
      latestDecision,
    };
  }

  return {
    fetchEvents,
    loadLatestDecision,
    loadSessionSummary,
    loadSnapshot,
    loadStatus,
  };
}
