export function createCompanionConsoleWorkflow({
  fetchImpl = globalThis.fetch,
  statusEndpoint = "http://127.0.0.1:5174/settings/status",
  eventsEndpoint = "http://127.0.0.1:5174/events",
  sessionSummaryEndpoint = "http://127.0.0.1:5174/session/summary",
  readinessEndpoint = "http://127.0.0.1:5174/readiness/diagnostic",
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

  async function loadReadinessDiagnostic() {
    try {
      const payload = await fetchJson(readinessEndpoint);
      return normalizeReadinessDiagnostic(payload);
    } catch {
      return normalizeReadinessDiagnostic(null);
    }
  }

  async function loadSnapshot() {
    const [status, sessionSummary, latestDecision, readinessDiagnostic] =
      await Promise.all([
        loadStatus(),
        loadSessionSummary(),
        loadLatestDecision(),
        loadReadinessDiagnostic(),
      ]);

    return {
      status,
      sessionSummary,
      latestDecision,
      readinessDiagnostic,
    };
  }

  return {
    fetchEvents,
    loadLatestDecision,
    loadReadinessDiagnostic,
    loadSessionSummary,
    loadSnapshot,
    loadStatus,
  };
}

function normalizeReadinessDiagnostic(payload = {}) {
  return {
    permissions: normalizeReadinessState(payload?.permissions, "unknown"),
    hooks: {
      codex: normalizeReadinessState(payload?.hooks?.codex, "missing"),
      claudeCode: normalizeReadinessState(payload?.hooks?.claudeCode, "missing"),
    },
    promptWatcher: normalizeReadinessState(payload?.promptWatcher, "blocked"),
  };
}

function normalizeReadinessState(value, fallback) {
  const state = String(value ?? "");
  return state ? state : fallback;
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

export function createGuidedReadiness({
  status = {},
  overlaySettingsState = "checking",
  permissions = "unknown",
  hooks = {},
  promptWatcher = "unknown",
} = {}) {
  const items = [
    createServerReadiness(status),
    createOverlayGuidedReadiness(overlaySettingsState),
    createPermissionReadiness(permissions),
    createHookReadiness({
      id: "codex-hooks",
      label: "Codex hooks",
      state: hooks.codex,
      command: "npm run setup:hooks -- codex",
    }),
    createHookReadiness({
      id: "claude-code-hooks",
      label: "Claude Code hooks",
      state: hooks.claudeCode,
      command: "npm run setup:hooks -- claude-code",
    }),
    createAiKeyReadiness(status),
    createPromptWatcherReadiness(promptWatcher),
  ];
  const nextItem = items.find((item) => item.blocksFlow) ?? null;

  return {
    blocked: Boolean(nextItem),
    nextItem,
    items,
  };
}

function createReadinessItem({
  id,
  label,
  state,
  why,
  action,
  command = "",
  skipImpact,
  blocksFlow = false,
}) {
  return {
    id,
    label,
    state,
    why,
    action,
    command,
    retryLabel: "重新檢查",
    skipImpact,
    blocksFlow,
  };
}

function createServerReadiness(status) {
  const ready = status.server === "online";
  return createReadinessItem({
    id: "server",
    label: ready ? "Server online" : "啟動本機 server",
    state: ready ? "ready" : "needs-action",
    why: "Dashboard、hook 測試事件與 overlay 都透過本機 event server 溝通。",
    action: ready
      ? "本機 event server 已可連線。"
      : "執行 npm run companion:start，讓本機 event server 開始接收工作事件。",
    command: ready ? "" : "npm run companion:start",
    skipImpact: "跳過後仍可看 Dashboard，但 hook 與 overlay 事件不會同步。",
    blocksFlow: !ready,
  });
}

function createOverlayGuidedReadiness(overlaySettingsState) {
  const ready = overlaySettingsState === "loaded";
  return createReadinessItem({
    id: "overlay",
    label: ready ? "Overlay ready" : "確認 desktop overlay",
    state: ready ? "ready" : "needs-action",
    why: "Overlay 讓 companion 能在 Codex 或 Claude Code 工作畫面旁反應。",
    action: ready
      ? "已載入 overlay 調校。"
      : "啟動 overlay 並套用調校；若只想試用 Dashboard，可先跳過。",
    command: ready ? "" : "npm run overlay",
    skipImpact: "跳過後 Prompt Coach 仍可用，但桌面旁不會出現 companion。",
    blocksFlow: !ready,
  });
}

function createPermissionReadiness(permissions) {
  const ready = permissions === "ready";
  return createReadinessItem({
    id: "permissions",
    label: ready ? "macOS permissions ready" : "檢查 macOS permissions",
    state: ready ? "ready" : "needs-action",
    why: "Accessibility 權限可讓 overlay 避開輸入區，也讓 prompt watcher 讀取可用文字欄位。",
    action: ready
      ? "macOS 權限已可用。"
      : "到 System Settings 開啟 Accessibility；無法開啟時可改用 Dashboard textarea。",
    skipImpact: "跳過後仍可手動輸入 prompt draft，但自動讀取與精準避讓會降級。",
    blocksFlow: !ready,
  });
}

function createHookReadiness({ id, label, state, command }) {
  const ready = state === "ready";
  return createReadinessItem({
    id,
    label: ready ? `${label} ready` : `安裝 ${label}`,
    state: ready ? "ready" : "needs-action",
    why: `${label} 會把 agent 工作狀態轉成本機 companion event。`,
    action: ready
      ? `${label} 已可發送事件。`
      : `執行 ${command}，或先用 Dashboard hook test event 驗證事件管線。`,
    command: ready ? "" : command,
    skipImpact: `跳過後仍可用 Dashboard demo event，但 ${label} 不會自動驅動 companion。`,
    blocksFlow: !ready,
  });
}

function createAiKeyReadiness(status) {
  const ready = status.ai === "configured";
  return createReadinessItem({
    id: "ai-key",
    label: ready ? "AI key configured" : "AI key optional",
    state: ready ? "ready" : "optional",
    why: "AI key 只增強 Vision context 與 optional AI decision；核心 companion 不依賴它。",
    action: ready
      ? `模型：${status.model ?? "not set"}`
      : "可稍後設定 Google AI Studio key；沒有 key 時 deterministic companion、Prompt Coach 與 hook-driven overlay 仍可用，只有 Vision context 與 optional AI decision 會停用。",
    command: ready ? "" : "npm run companion:setup-key",
    skipImpact: "跳過後只會少掉 Vision context 與 optional AI decision。",
    blocksFlow: false,
  });
}

function createPromptWatcherReadiness(promptWatcher) {
  const ready = promptWatcher === "ready";
  return createReadinessItem({
    id: "prompt-watcher",
    label: ready ? "Prompt watcher ready" : "Prompt watcher fallback",
    state: ready ? "ready" : "needs-action",
    why: "Prompt watcher 可以在可讀文字欄位 settled 後提供 prompt draft 建議。",
    action: ready
      ? "Prompt watcher 已可用。"
      : "若目標 app 不暴露文字欄位或權限不足，請改用 Dashboard Prompt Coach textarea。",
    command: ready ? "" : "npm run watch:prompt",
    skipImpact: "跳過後自動偵測 draft 會停用，但 Dashboard textarea 仍可產生建議。",
    blocksFlow: false,
  });
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
