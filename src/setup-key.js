import { createCompanionConsoleWorkflow } from "./companion-console-workflow.js";
import { recommendSkillForTask } from "./skill-recommender.js";

const DEFAULT_ENDPOINT = "http://127.0.0.1:5174/settings/google-ai-key";
const DEFAULT_STATUS_ENDPOINT = "http://127.0.0.1:5174/settings/status";
const DEFAULT_EVENTS_ENDPOINT = "http://127.0.0.1:5174/events";
const DEFAULT_SESSION_SUMMARY_ENDPOINT =
  "http://127.0.0.1:5174/session/summary";
const DEFAULT_OVERLAY_SETTINGS_ENDPOINT =
  "http://127.0.0.1:5174/settings/overlay";
const DEFAULT_VISION_ENDPOINT = "http://127.0.0.1:5174/vision/context";
const DEFAULT_PLACEMENT_DIAGNOSTIC_ENDPOINT =
  "http://127.0.0.1:5174/placement/diagnostic";
const DEFAULT_MODEL = "gemma-4-31b-it";

export function mountSetupKeyPage(
  root,
  {
    fetchImpl = fetch,
    endpoint = DEFAULT_ENDPOINT,
    statusEndpoint = DEFAULT_STATUS_ENDPOINT,
    eventsEndpoint = DEFAULT_EVENTS_ENDPOINT,
    sessionSummaryEndpoint = DEFAULT_SESSION_SUMMARY_ENDPOINT,
    overlaySettingsEndpoint = DEFAULT_OVERLAY_SETTINGS_ENDPOINT,
    visionEndpoint = DEFAULT_VISION_ENDPOINT,
    placementDiagnosticEndpoint = DEFAULT_PLACEMENT_DIAGNOSTIC_ENDPOINT,
    captureScreenFrame = captureScreenFrameOnce,
    model = DEFAULT_MODEL,
  } = {}
) {
  const consoleWorkflow = createCompanionConsoleWorkflow({
    fetchImpl,
    statusEndpoint,
    eventsEndpoint,
    sessionSummaryEndpoint,
  });

  root.innerHTML = `
    <section class="setup-shell" data-setup-root>
      <div class="setup-panel">
        <header class="setup-header">
          <div>
            <p class="setup-kicker">Local companion control</p>
            <h1>Companion Console</h1>
          </div>
          <button class="ghost-button" data-refresh-status type="button">更新</button>
        </header>
        <dl class="status-grid" data-status-grid>
          <div>
            <dt>Server</dt>
            <dd data-server-status>checking</dd>
          </div>
          <div>
            <dt>AI</dt>
            <dd data-ai-status>checking</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd data-model-status>checking</dd>
          </div>
        </dl>
        <section class="session-panel" data-session-summary-panel>
          <div class="session-summary-top">
            <div>
              <p class="panel-label">Session summary</p>
              <p class="session-summary-title" data-session-summary-title>
                等待工作狀態
              </p>
            </div>
            <span class="session-summary-phase" data-session-summary-phase>
              waiting
            </span>
          </div>
          <p class="session-summary-body" data-session-summary-body>
            尚未有足夠脈絡。
          </p>
          <p class="session-summary-signals" data-session-summary-signals>
            no signals
          </p>
        </section>
        <section class="test-panel" data-test-panel>
          <div>
            <p class="panel-label">AI smoke test</p>
            <p class="decision-line" data-last-ai-decision>尚未測試。</p>
          </div>
          <button class="test-button" data-send-test-event type="button">
            送測試事件
          </button>
        </section>
        <section class="vision-panel" data-vision-panel>
          <div>
            <p class="panel-label">Vision context</p>
            <p class="decision-line" data-vision-context>尚未分析。</p>
          </div>
          <button class="vision-button" data-analyze-screen type="button">
            分析目前畫面
          </button>
        </section>
        <section class="skill-panel" data-skill-panel>
          <div>
            <p class="panel-label">Next step</p>
            <p class="next-step-skill" data-skill-hint>尚未推薦。</p>
            <p class="next-step-title" data-next-step-title>尚未產生建議。</p>
            <p class="next-step-action" data-next-step-action>等待工作狀態。</p>
            <p class="next-step-reason" data-next-step-reason>尚未有足夠脈絡。</p>
            <span class="next-step-priority" data-next-step-priority>low</span>
          </div>
        </section>
        <section class="placement-panel" data-placement-panel>
          <div class="placement-header">
            <div>
              <p class="panel-label">Placement diagnostic</p>
              <p class="decision-line" data-placement-mode>尚未檢查。</p>
            </div>
            <button class="ghost-button" data-refresh-placement type="button">
              檢查定位
            </button>
          </div>
          <dl class="placement-grid">
            <div>
              <dt>Foreground</dt>
              <dd data-placement-foreground>unknown</dd>
            </div>
            <div>
              <dt>No-fly</dt>
              <dd data-placement-avoid>unknown</dd>
            </div>
            <div>
              <dt>Bounds</dt>
              <dd data-placement-bounds>unknown</dd>
            </div>
          </dl>
        </section>
        <form class="setup-form" data-setup-form>
          <label class="setup-field">
            <span>API Key</span>
            <input
              data-api-key-input
              type="password"
              autocomplete="off"
              spellcheck="false"
              placeholder="貼上新的 Google AI Studio API key"
            />
          </label>
          <button data-save-api-key type="submit" disabled>儲存</button>
        </form>
        <p class="setup-status" data-setup-status>等待輸入。</p>
        <form class="overlay-settings-form" data-overlay-settings-form>
          <div class="form-section-header">
            <p class="panel-label">Overlay calibration</p>
            <p class="section-note">套用後 overlay 會自動讀取，不用重啟。</p>
          </div>
          <div class="control-grid">
            <label class="setup-field">
              <span>Idle size</span>
              <input data-overlay-idle-size type="number" min="48" max="120" step="1" />
            </label>
            <label class="setup-field">
              <span>Active size</span>
              <input data-overlay-active-scale type="number" min="0.75" max="1.35" step="0.05" />
            </label>
            <label class="setup-field">
              <span>Wander speed</span>
              <input data-overlay-wander-speed type="number" min="0.5" max="2" step="0.1" />
            </label>
            <label class="setup-field">
              <span>Safe margin</span>
              <input data-overlay-safe-margin type="number" min="0" max="80" step="1" />
            </label>
            <label class="setup-field">
              <span>Preferred side</span>
              <select data-overlay-preferred-side>
                <option value="auto">Auto</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </label>
          </div>
          <button data-save-overlay-settings type="submit">套用調校</button>
          <p class="setup-status" data-overlay-settings-status>等待設定。</p>
        </form>
      </div>
    </section>
  `;

  const form = root.querySelector("[data-setup-form]");
  const input = root.querySelector("[data-api-key-input]");
  const button = root.querySelector("[data-save-api-key]");
  const status = root.querySelector("[data-setup-status]");
  const refreshButton = root.querySelector("[data-refresh-status]");
  const testButton = root.querySelector("[data-send-test-event]");
  const lastAiDecision = root.querySelector("[data-last-ai-decision]");
  const visionButton = root.querySelector("[data-analyze-screen]");
  const visionContext = root.querySelector("[data-vision-context]");
  const skillHint = root.querySelector("[data-skill-hint]");
  const nextStepTitle = root.querySelector("[data-next-step-title]");
  const nextStepAction = root.querySelector("[data-next-step-action]");
  const nextStepReason = root.querySelector("[data-next-step-reason]");
  const nextStepPriority = root.querySelector("[data-next-step-priority]");
  const refreshPlacementButton = root.querySelector("[data-refresh-placement]");
  const placementMode = root.querySelector("[data-placement-mode]");
  const placementForeground = root.querySelector("[data-placement-foreground]");
  const placementAvoid = root.querySelector("[data-placement-avoid]");
  const placementBounds = root.querySelector("[data-placement-bounds]");
  const serverStatus = root.querySelector("[data-server-status]");
  const aiStatus = root.querySelector("[data-ai-status]");
  const modelStatus = root.querySelector("[data-model-status]");
  const sessionSummaryTitle = root.querySelector("[data-session-summary-title]");
  const sessionSummaryPhase = root.querySelector("[data-session-summary-phase]");
  const sessionSummaryBody = root.querySelector("[data-session-summary-body]");
  const sessionSummarySignals = root.querySelector(
    "[data-session-summary-signals]"
  );
  const overlaySettingsForm = root.querySelector("[data-overlay-settings-form]");
  const idleSizeInput = root.querySelector("[data-overlay-idle-size]");
  const activeScaleInput = root.querySelector("[data-overlay-active-scale]");
  const wanderSpeedInput = root.querySelector("[data-overlay-wander-speed]");
  const safeMarginInput = root.querySelector("[data-overlay-safe-margin]");
  const preferredSideInput = root.querySelector("[data-overlay-preferred-side]");
  const overlaySettingsStatus = root.querySelector(
    "[data-overlay-settings-status]"
  );

  function setOverlayInputs(settings) {
    idleSizeInput.value = String(settings.idleSize);
    activeScaleInput.value = String(settings.activeScale);
    wanderSpeedInput.value = String(settings.wanderSpeed);
    safeMarginInput.value = String(settings.safeMargin);
    preferredSideInput.value = normalizePreferredSide(settings.preferredSide);
  }

  async function refreshOverlaySettings() {
    try {
      const response = await fetchImpl(overlaySettingsEndpoint);
      if (!response.ok) throw new Error("overlay_settings_failed");
      const payload = await response.json();
      if (payload.settings) {
        setOverlayInputs(payload.settings);
        overlaySettingsStatus.textContent = "已載入目前調校。";
      }
    } catch {
      setOverlayInputs({
        idleSize: 64,
        activeScale: 1,
        wanderSpeed: 1,
        safeMargin: 24,
        preferredSide: "auto",
      });
      overlaySettingsStatus.textContent = "無法讀取調校，已使用預設值。";
    }
  }

  async function refreshStatus() {
    serverStatus.textContent = "checking";
    aiStatus.textContent = "checking";
    modelStatus.textContent = "checking";

    const statusSnapshot = await consoleWorkflow.loadStatus();
    serverStatus.textContent = statusSnapshot.server;
    aiStatus.textContent = statusSnapshot.ai;
    modelStatus.textContent = statusSnapshot.model;
  }

  async function refreshSessionSummary() {
    renderSessionSummary(await consoleWorkflow.loadSessionSummary());
  }

  async function fetchEvents() {
    return consoleWorkflow.fetchEvents();
  }

  async function waitForAiDecision({ timeoutMs = 12000 } = {}) {
    const start = Date.now();
    let latestDecision = null;

    while (Date.now() - start < timeoutMs) {
      const payload = await fetchEvents();
      latestDecision = [...(payload.events ?? [])]
        .reverse()
        .find((item) => item.event?.type === "ai:decision")?.event;

      if (latestDecision) {
        return latestDecision;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return null;
  }

  async function refreshLatestDecision() {
    const decision = await consoleWorkflow.loadLatestDecision();
    if (!decision) {
      return;
    }

    skillHint.textContent = formatSkillHint(decision.skillHint);
    if (decision.nextStepAdvice) {
      renderNextStepAdvice(decision.nextStepAdvice);
    }
  }

  async function sendTestEvent() {
    testButton.disabled = true;
    lastAiDecision.textContent = "測試中...";

    try {
      await fetchImpl(eventsEndpoint, { method: "DELETE" });
      const response = await fetchImpl(eventsEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "tool:finish",
          tool: "test",
          status: "failed",
        }),
      });
      if (!response.ok) throw new Error("event_failed");

      const decision = await waitForAiDecision();
      lastAiDecision.textContent = decision
        ? `${decision.state} / ${decision.motion}: ${decision.line}`
        : "沒有收到 AI decision。";
      skillHint.textContent = formatSkillHint(decision?.skillHint);
      renderNextStepAdvice(decision?.nextStepAdvice);
      await refreshSessionSummary();
    } catch {
      lastAiDecision.textContent = "測試失敗，請確認 companion server 正在執行。";
    } finally {
      testButton.disabled = false;
    }
  }

  async function analyzeScreenContext() {
    visionButton.disabled = true;
    visionContext.textContent = "等待選擇畫面...";

    try {
      const imageDataUrl = await captureScreenFrame();
      visionContext.textContent = "分析中...";
      const response = await fetchImpl(visionEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageDataUrl }),
      });
      if (!response.ok) throw new Error("vision_context_failed");
      const payload = await response.json();
      visionContext.textContent = formatVisionContext(payload.context);
      skillHint.textContent = formatSkillHint(
        payload.context ? recommendSkillForTask(payload.context) : null
      );
      renderNextStepAdvice(null);
      await refreshSessionSummary();
      await refreshLatestDecision();
    } catch {
      visionContext.textContent =
        "分析失敗，請確認畫面權限與 companion server。";
    } finally {
      visionButton.disabled = false;
    }
  }

  async function refreshPlacementDiagnostic() {
    refreshPlacementButton.disabled = true;
    placementMode.textContent = "檢查中...";

    try {
      const response = await fetchImpl(
        `${placementDiagnosticEndpoint}?state=coding&safeZone=right-edge&preferredSide=${encodeURIComponent(
          normalizePreferredSide(preferredSideInput.value)
        )}`
      );
      if (!response.ok) throw new Error("placement_diagnostic_failed");
      const diagnostic = await response.json();
      placementMode.textContent = formatPlacementMode(diagnostic);
      placementForeground.textContent = formatPlacementForeground(diagnostic);
      placementAvoid.textContent = formatPlacementAvoidance(diagnostic);
      placementBounds.textContent = formatPlacementBounds(diagnostic);
    } catch {
      placementMode.textContent = "無法取得定位診斷。";
      placementForeground.textContent = "unknown";
      placementAvoid.textContent = "unknown";
      placementBounds.textContent = "unknown";
    } finally {
      refreshPlacementButton.disabled = false;
    }
  }

  function renderNextStepAdvice(advice) {
    if (!advice) {
      nextStepTitle.textContent = "尚未產生建議。";
      nextStepAction.textContent = "等待工作狀態。";
      nextStepReason.textContent = "尚未有足夠脈絡。";
      nextStepPriority.textContent = "low";
      return;
    }

    nextStepTitle.textContent = String(advice.title ?? "下一步建議");
    nextStepAction.textContent = String(advice.action ?? "先切一個小步驟。");
    nextStepReason.textContent = String(advice.reason ?? "依目前狀態推測。");
    nextStepPriority.textContent = String(advice.priority ?? "low");
  }

  function renderSessionSummary(summary) {
    if (!summary) {
      sessionSummaryTitle.textContent = "等待工作狀態";
      sessionSummaryPhase.textContent = "waiting";
      sessionSummaryBody.textContent = "尚未有足夠脈絡。";
      sessionSummarySignals.textContent = "no signals";
      return;
    }

    sessionSummaryTitle.textContent = String(summary.title ?? "Session");
    sessionSummaryPhase.textContent = String(summary.phase ?? "unknown");
    sessionSummaryBody.textContent = String(
      summary.summary ?? "尚未有足夠脈絡。"
    );
    sessionSummarySignals.textContent = Array.isArray(summary.signals)
      ? summary.signals.join(" / ") || "no signals"
      : "no signals";
  }

  input.addEventListener("input", () => {
    button.disabled = input.value.trim().length === 0;
  });
  refreshButton.addEventListener("click", () => {
    void refreshStatus();
    void refreshSessionSummary();
  });
  testButton.addEventListener("click", sendTestEvent);
  visionButton.addEventListener("click", analyzeScreenContext);
  refreshPlacementButton.addEventListener("click", refreshPlacementDiagnostic);
  overlaySettingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const settings = {
      idleSize: Number(idleSizeInput.value),
      activeScale: Number(activeScaleInput.value),
      wanderSpeed: Number(wanderSpeedInput.value),
      safeMargin: Number(safeMarginInput.value),
      preferredSide: normalizePreferredSide(preferredSideInput.value),
    };

    overlaySettingsStatus.textContent = "套用中...";

    try {
      const response = await fetchImpl(overlaySettingsEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error("overlay_settings_save_failed");
      const payload = await response.json();
      setOverlayInputs(payload.settings ?? settings);
      overlaySettingsStatus.textContent = "已套用 overlay 調校。";
    } catch {
      overlaySettingsStatus.textContent =
        "套用失敗，請確認 companion server 正在執行。";
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const apiKey = input.value.trim();
    if (!apiKey) return;

    button.disabled = true;
    status.textContent = "儲存中...";

    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey, model }),
      });
      if (!response.ok) {
        throw new Error("save_failed");
      }
      await response.json();
      input.value = "";
      status.textContent = `已儲存，模型：${model}`;
      await refreshStatus();
    } catch {
      button.disabled = false;
      status.textContent = "儲存失敗，請確認 companion server 正在執行。";
    }
  });

  input.focus();
  void refreshStatus();
  void refreshSessionSummary();
  void refreshLatestDecision();
  void refreshOverlaySettings();

  return {
    root,
    refreshStatus,
    refreshSessionSummary,
    refreshLatestDecision,
    refreshOverlaySettings,
    sendTestEvent,
    analyzeScreenContext,
    refreshPlacementDiagnostic,
  };
}

export async function captureScreenFrameOnce({
  mediaDevices = globalThis.navigator?.mediaDevices,
  documentRef = globalThis.document,
  maxWidth = 960,
} = {}) {
  if (!mediaDevices?.getDisplayMedia || !documentRef) {
    throw new Error("screen_capture_unavailable");
  }

  const stream = await mediaDevices.getDisplayMedia({
    video: { frameRate: 1 },
    audio: false,
  });

  try {
    const video = documentRef.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = reject;
    });
    await video.play();

    const sourceWidth = video.videoWidth || maxWidth;
    const sourceHeight = video.videoHeight || Math.round(maxWidth * 0.625);
    const scale = Math.min(1, maxWidth / sourceWidth);
    const canvas = documentRef.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("screen_capture_canvas_unavailable");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/png");
  } finally {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }
}

function formatVisionContext(context) {
  if (!context) {
    return "AI 沒有回傳可用判斷。";
  }

  const state = context.suggestedState
    ? String(context.suggestedState).toUpperCase()
    : "UNKNOWN";
  const confidence = Number.isFinite(Number(context.confidence))
    ? `${Math.round(Number(context.confidence) * 100)}%`
    : "n/a";
  const activity = String(context.activity ?? "沒有活動摘要。");

  return `${state} / ${confidence}: ${activity}`;
}

function formatSkillHint(skillHint) {
  if (!skillHint?.skill) {
    return "尚未推薦。";
  }

  const confidence = skillHint.confidence
    ? ` / ${String(skillHint.confidence)}`
    : "";
  const reason = skillHint.reason ? `：${String(skillHint.reason)}` : "";

  return `${String(skillHint.skill)}${confidence}${reason}`;
}

function formatPlacementMode(diagnostic) {
  if (!diagnostic?.ok) {
    return diagnostic?.placementMode ?? "unavailable";
  }

  const state = String(diagnostic.state ?? "unknown");
  const safeZone = String(diagnostic.safeZone ?? "unknown");
  const mode = String(diagnostic.placementMode ?? "unknown");

  return `${mode} / ${state} / ${safeZone}`;
}

function formatPlacementForeground(diagnostic) {
  const foreground = diagnostic?.foreground;
  if (!foreground) return "unknown";

  const appName = foreground.appName || "unknown app";
  const visible = foreground.visible ? "visible" : "hidden";
  const bounds = foreground.bounds
    ? ` ${foreground.bounds.width}x${foreground.bounds.height}`
    : "";

  return `${appName} / ${visible}${bounds}`;
}

function formatPlacementAvoidance(diagnostic) {
  const count = Number(diagnostic?.avoidRegionCount ?? 0);
  const accessibility = diagnostic?.accessibility;
  const accessibilityText = accessibility
    ? `AX ${accessibility.status}:${accessibility.regionCount}`
    : "AX unknown";

  return `${count} no-fly / ${accessibilityText}`;
}

function formatPlacementBounds(diagnostic) {
  const bounds = diagnostic?.chosenBounds;
  if (!bounds) return "not placed";

  return `${bounds.width}x${bounds.height} @ ${bounds.x},${bounds.y}`;
}

function normalizePreferredSide(value) {
  const side = String(value ?? "").trim();
  return ["auto", "left", "right"].includes(side) ? side : "auto";
}
