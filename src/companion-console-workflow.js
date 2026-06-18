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

export function createRuntimeReadiness({
  status = {},
  overlaySettingsState = "checking",
} = {}) {
  const serverOnline = status.server === "online";
  const aiConfigured = status.ai === "configured";

  const server = serverOnline
    ? {
        state: "ready",
        stateLabel: "ready",
        label: "Runtime online",
        action: "本機 settings 與 event server 已可連線。",
        command: "",
      }
    : {
        state: "needs-action",
        stateLabel: "action",
        label: "啟動本機 runtime",
        action: "先執行 npm run companion:start，讓 Console、event server 與 overlay 一起啟動。",
        command: "npm run companion:start",
      };

  const ai = aiConfigured
    ? {
        state: "ready",
        stateLabel: "ready",
        label: "AI key configured",
        action: `模型：${status.model ?? "not set"}`,
        command: "",
      }
    : {
        state: "needs-action",
        stateLabel: status.ai === "missing" ? "missing" : "unknown",
        label: "設定 Google AI key",
        action: "執行 npm run companion:setup-key，貼上 Google AI Studio API key。",
        command: "npm run companion:setup-key",
      };

  const overlay = createOverlayReadiness(overlaySettingsState);
  const primaryStep = [server, ai, overlay].find(
    (step) => step.state !== "ready"
  );

  return {
    primaryCommand: primaryStep?.command || "ready",
    primaryAction: primaryStep?.action || "Runtime、AI key 與 overlay 調校皆已就緒。",
    server,
    ai,
    overlay,
  };
}

function createOverlayReadiness(overlaySettingsState) {
  if (overlaySettingsState === "loaded") {
    return {
      state: "ready",
      stateLabel: "ready",
      label: "Overlay calibrated",
      action: "已載入目前 overlay 調校。",
      command: "",
    };
  }

  if (overlaySettingsState === "defaulted") {
    return {
      state: "needs-action",
      stateLabel: "fallback",
      label: "套用 overlay 調校",
      action: "Console 已使用預設值；runtime 啟動後按「套用調校」寫回設定。",
      command: "套用 overlay 調校",
    };
  }

  return {
    state: "checking",
    stateLabel: "checking",
    label: "檢查 overlay 調校",
    action: "正在讀取本機 overlay 設定。",
    command: "",
  };
}
