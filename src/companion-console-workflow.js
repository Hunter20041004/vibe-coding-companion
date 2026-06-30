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
        label: "本機服務已連線",
        action: "本機設定與事件服務已可連線。",
        command: "",
      }
    : {
        state: "needs-action",
        stateLabel: "action",
        label: "啟動本機服務",
        action: "先執行 npm run companion:start，讓 Dashboard、事件服務與桌面小精靈一起啟動。",
        command: "npm run companion:start",
      };

  const ai = aiConfigured
    ? {
        state: "ready",
        stateLabel: "ready",
        label: "AI key 已設定",
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
    primaryAction: primaryStep?.action || "本機服務、AI key 與桌面小精靈調校皆已就緒。",
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
    label: ready ? "本機服務已連線" : "啟動本機服務",
    state: ready ? "ready" : "needs-action",
    why: "Dashboard、測試事件與桌面小精靈都透過本機服務溝通。",
    action: ready
      ? "本機服務已可連線。"
      : "執行 npm run companion:start，讓本機服務開始接收工作事件。",
    command: ready ? "" : "npm run companion:start",
    skipImpact: "跳過後仍可看 Dashboard，但工作事件與桌面小精靈不會同步。",
    blocksFlow: !ready,
  });
}

function createOverlayGuidedReadiness(overlaySettingsState) {
  const ready = overlaySettingsState === "loaded";
  return createReadinessItem({
    id: "overlay",
    label: ready ? "桌面小精靈已就緒" : "確認桌面小精靈",
    state: ready ? "ready" : "needs-action",
    why: "桌面小精靈能在 Codex 或 Claude Code 工作畫面旁反應。",
    action: ready
      ? "已載入桌面小精靈調校。"
      : "啟動桌面小精靈並套用調校；若只想試用 Dashboard，可先跳過。",
    command: ready ? "" : "npm run overlay",
    skipImpact: "跳過後 Prompt Coach 仍可用，但桌面旁不會出現小精靈。",
    blocksFlow: !ready,
  });
}

function createPermissionReadiness(permissions) {
  const ready = permissions === "ready";
  return createReadinessItem({
    id: "permissions",
    label: ready ? "macOS 權限已設定" : "檢查 macOS 權限",
    state: ready ? "ready" : "needs-action",
    why: "Accessibility 權限可讓桌面小精靈避開輸入區，也讓自動讀取取得可用文字欄位。",
    action: ready
      ? "macOS 權限已可用。"
      : "到 System Settings 開啟 Accessibility；無法開啟時可改用 Dashboard 文字框。",
    skipImpact: "跳過後仍可手動輸入 prompt 草稿，但自動讀取與精準避讓會降級。",
    blocksFlow: !ready,
  });
}

function createHookReadiness({ id, label, state, command }) {
  const ready = state === "ready";
  return createReadinessItem({
    id,
    label: ready ? `${label} 已安裝` : `安裝 ${label}`,
    state: ready ? "ready" : "needs-action",
    why: `${label} 會把 agent 工作狀態轉成本機小精靈事件。`,
    action: ready
      ? `${label} 已可發送事件。`
      : `執行 ${command}，或先用 Dashboard 測試按鈕驗證事件管線。`,
    command: ready ? "" : command,
    skipImpact: `跳過後仍可用 Dashboard 測試事件，但 ${label} 不會自動驅動小精靈。`,
    blocksFlow: !ready,
  });
}

function createAiKeyReadiness(status) {
  const ready = status.ai === "configured";
  return createReadinessItem({
    id: "ai-key",
    label: ready ? "AI key 已設定" : "AI key 可稍後設定",
    state: ready ? "ready" : "optional",
    why: "AI key 只增強畫面分析與進階判斷；核心小精靈不依賴它。",
    action: ready
      ? `模型：${status.model ?? "not set"}`
      : "可稍後設定 Google AI Studio key；沒有 key 時 Prompt Coach 與桌面小精靈仍可用，只有畫面分析和進階判斷會停用。",
    command: ready ? "" : "npm run companion:setup-key",
    skipImpact: "跳過後只會少掉畫面分析和進階判斷。",
    blocksFlow: false,
  });
}

function createPromptWatcherReadiness(promptWatcher) {
  const ready = promptWatcher === "ready";
  return createReadinessItem({
    id: "prompt-watcher",
    label: ready ? "自動讀取輸入框已就緒" : "自動讀取輸入框可稍後處理",
    state: ready ? "ready" : "needs-action",
    why: "自動讀取可以在你停下輸入後提供 prompt 草稿建議。",
    action: ready
      ? "自動讀取已可用。"
      : "若目標 app 不暴露文字欄位或權限不足，請改用 Dashboard Prompt Coach 文字框。",
    command: ready ? "" : "npm run watch:prompt",
    skipImpact: "跳過後自動偵測草稿會停用，但 Dashboard 文字框仍可產生建議。",
    blocksFlow: false,
  });
}

function createOverlayReadiness(overlaySettingsState) {
  if (overlaySettingsState === "loaded") {
    return {
      state: "ready",
      stateLabel: "ready",
      label: "桌面小精靈已調校",
      action: "已載入目前桌面小精靈調校。",
      command: "",
    };
  }

  if (overlaySettingsState === "defaulted") {
    return {
      state: "needs-action",
      stateLabel: "fallback",
      label: "套用桌面小精靈調校",
      action: "Dashboard 已使用預設值；本機服務啟動後按「套用調校」寫回設定。",
      command: "套用調校",
    };
  }

  return {
    state: "checking",
    stateLabel: "checking",
    label: "檢查桌面小精靈調校",
    action: "正在讀取本機桌面小精靈設定。",
    command: "",
  };
}
