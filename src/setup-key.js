import {
  createCompanionConsoleWorkflow,
  createGuidedReadiness,
  createRuntimeReadiness,
} from "./companion-console-workflow.js";
import { characterizeAdvice } from "./characterized-advice.js";
import {
  getCharacterProfile,
  listCharacterProfiles,
  normalizeCharacterId,
} from "./character-profiles.js";
import { createPreferenceStore } from "./preferences.js";
import { recommendSkillForTask } from "./skill-recommender.js";

const DEFAULT_ENDPOINT = "http://127.0.0.1:5174/settings/google-ai-key";
const DEFAULT_STATUS_ENDPOINT = "http://127.0.0.1:5174/settings/status";
const DEFAULT_EVENTS_ENDPOINT = "http://127.0.0.1:5174/events";
const DEFAULT_SESSION_SUMMARY_ENDPOINT =
  "http://127.0.0.1:5174/session/summary";
const DEFAULT_READINESS_ENDPOINT =
  "http://127.0.0.1:5174/readiness/diagnostic";
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
    readinessEndpoint = DEFAULT_READINESS_ENDPOINT,
    overlaySettingsEndpoint = DEFAULT_OVERLAY_SETTINGS_ENDPOINT,
    visionEndpoint = DEFAULT_VISION_ENDPOINT,
    placementDiagnosticEndpoint = DEFAULT_PLACEMENT_DIAGNOSTIC_ENDPOINT,
    captureScreenFrame = captureScreenFrameOnce,
    model = DEFAULT_MODEL,
    promptDraftDelayMs = 450,
    aiDecisionTimeoutMs = 12000,
    preferenceStore = createDefaultPreferenceStore(),
  } = {}
) {
  const consoleWorkflow = createCompanionConsoleWorkflow({
    fetchImpl,
    statusEndpoint,
    eventsEndpoint,
    sessionSummaryEndpoint,
    readinessEndpoint,
  });

  root.innerHTML = `
    <section class="setup-shell" data-setup-root>
      <div class="setup-panel">
        <header class="setup-header">
          <div>
            <p class="setup-kicker">Daily coding companion</p>
            <h1>Companion Dashboard</h1>
          </div>
          <button class="ghost-button" data-refresh-status type="button">更新</button>
        </header>

        <section
          class="companion-stage"
          data-companion-stage
          data-dashboard-section="companion-stage"
        >
          <div class="stage-orb" data-stage-orb aria-hidden="true">
            <span class="stage-orb-core"></span>
            <span class="stage-orb-tail"></span>
          </div>
          <div class="stage-copy">
            <p class="panel-label">Companion Stage</p>
            <h2 data-active-character-name>宇宙水母</h2>
            <p class="stage-tagline" data-active-character-tagline>冷靜導航</p>
            <p class="stage-bubble" data-active-character-bubble>
              先確認本機狀態，再切一個小步驟。
            </p>
          </div>
          <div class="stage-status">
            <span data-stage-work-state>checking</span>
            <strong data-stage-next-step>本機 companion 啟動清單</strong>
          </div>
        </section>

        <section
          class="skill-panel"
          data-skill-panel
          data-dashboard-section="next-step"
        >
          <div>
            <p class="panel-label">Next step</p>
            <p class="next-step-skill" data-skill-hint>尚未推薦。</p>
            <p class="next-step-title" data-next-step-title>尚未產生建議。</p>
            <p class="next-step-action" data-next-step-action>等待工作狀態。</p>
            <p class="next-step-reason" data-next-step-reason>尚未有足夠脈絡。</p>
            <span class="next-step-priority" data-next-step-priority>low</span>
          </div>
        </section>

        <section
          class="characters-panel"
          data-characters-panel
          data-dashboard-section="characters"
        >
          <div class="section-heading">
            <div>
              <p class="panel-label">Characters</p>
              <h2>選擇今天的 companion</h2>
            </div>
            <span class="section-note">切換後會同步 Dashboard 與 overlay 語氣。</span>
          </div>
          <div class="character-list" data-character-list></div>
        </section>

        <section
          class="prompt-coach-panel"
          data-prompt-coach-panel
          data-dashboard-section="prompt-coach"
        >
          <div class="prompt-coach-top">
            <div>
              <p class="panel-label">Prompt coach</p>
              <p class="decision-line" data-prompt-coach-status>等待草稿。</p>
            </div>
            <span class="prompt-coach-state" data-prompt-coach-state>idle</span>
          </div>
          <label class="setup-field prompt-coach-field">
            <span>Draft</span>
            <textarea
              data-prompt-draft-input
              rows="4"
              autocomplete="off"
              spellcheck="false"
              placeholder="fix the failing checkout test..."
            ></textarea>
          </label>
          <p class="privacy-note" data-privacy-note>
            Short drafts are ignored. raw prompt is not saved in the event stream.
            Vision context is one approved, one-shot analysis; AI key is optional.
          </p>
        </section>

        <section
          class="guided-readiness-panel"
          data-guided-readiness
          data-dashboard-section="guided-readiness"
        >
          <div class="section-heading">
            <div>
              <p class="panel-label">Guided readiness</p>
              <h2 data-guided-readiness-title>檢查第一次使用狀態</h2>
            </div>
            <button class="ghost-button" data-refresh-readiness type="button">
              重新檢查
            </button>
          </div>
          <div class="readiness-list" data-readiness-list></div>
          <section class="runtime-panel" data-runtime-readiness>
            <div class="runtime-panel-header">
              <div>
                <p class="panel-label">Runtime readiness</p>
                <p class="runtime-title" data-runtime-title>檢查本機服務</p>
              </div>
              <code class="runtime-command" data-startup-command>checking</code>
            </div>
            <div class="runtime-steps">
              <div class="runtime-step" data-runtime-server>
                <span class="runtime-step-state">checking</span>
                <strong>檢查 runtime</strong>
                <span>正在讀取本機服務狀態。</span>
              </div>
              <div class="runtime-step" data-runtime-ai>
                <span class="runtime-step-state">checking</span>
                <strong>檢查 AI key</strong>
                <span>正在讀取 AI 設定。</span>
              </div>
              <div class="runtime-step" data-runtime-overlay>
                <span class="runtime-step-state">checking</span>
                <strong>檢查 overlay</strong>
                <span>正在讀取 overlay 調校。</span>
              </div>
            </div>
            <p class="runtime-action" data-startup-action>
              正在檢查 Companion Console 啟動狀態。
            </p>
          </section>
        </section>

        <section class="test-panel" data-test-panel>
          <div>
            <p class="panel-label">Hook test event</p>
            <p class="decision-line" data-last-ai-decision>尚未測試。</p>
          </div>
          <button class="test-button" data-send-test-event type="button">
            送 hook 測試事件
          </button>
        </section>

        <details
          class="diagnostics-panel"
          data-diagnostics-panel
          data-dashboard-section="diagnostics"
        >
          <summary>
            <span>Diagnostics</span>
            <small>placement、hooks、event stream、AI key 與 overlay 調校</small>
          </summary>
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
          <section class="vision-panel" data-vision-panel>
            <div>
              <p class="panel-label">Vision context</p>
              <p class="decision-line" data-vision-context>尚未分析。</p>
            </div>
            <button class="vision-button" data-analyze-screen type="button">
              分析目前畫面
            </button>
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
        </details>
      </div>
    </section>
  `;

  const form = root.querySelector("[data-setup-form]");
  const setupRoot = root.querySelector("[data-setup-root]");
  const input = root.querySelector("[data-api-key-input]");
  const button = root.querySelector("[data-save-api-key]");
  const status = root.querySelector("[data-setup-status]");
  const refreshButton = root.querySelector("[data-refresh-status]");
  const refreshReadinessButton = root.querySelector("[data-refresh-readiness]");
  const testButton = root.querySelector("[data-send-test-event]");
  const lastAiDecision = root.querySelector("[data-last-ai-decision]");
  const visionButton = root.querySelector("[data-analyze-screen]");
  const visionContext = root.querySelector("[data-vision-context]");
  const activeCharacterName = root.querySelector("[data-active-character-name]");
  const activeCharacterTagline = root.querySelector(
    "[data-active-character-tagline]"
  );
  const activeCharacterBubble = root.querySelector(
    "[data-active-character-bubble]"
  );
  const stageWorkState = root.querySelector("[data-stage-work-state]");
  const stageNextStep = root.querySelector("[data-stage-next-step]");
  const characterList = root.querySelector("[data-character-list]");
  const readinessList = root.querySelector("[data-readiness-list]");
  const guidedReadinessTitle = root.querySelector(
    "[data-guided-readiness-title]"
  );
  const skillHint = root.querySelector("[data-skill-hint]");
  const nextStepTitle = root.querySelector("[data-next-step-title]");
  const nextStepAction = root.querySelector("[data-next-step-action]");
  const nextStepReason = root.querySelector("[data-next-step-reason]");
  const nextStepPriority = root.querySelector("[data-next-step-priority]");
  const promptDraftInput = root.querySelector("[data-prompt-draft-input]");
  const promptCoachStatus = root.querySelector("[data-prompt-coach-status]");
  const promptCoachState = root.querySelector("[data-prompt-coach-state]");
  const refreshPlacementButton = root.querySelector("[data-refresh-placement]");
  const placementMode = root.querySelector("[data-placement-mode]");
  const placementForeground = root.querySelector("[data-placement-foreground]");
  const placementAvoid = root.querySelector("[data-placement-avoid]");
  const placementBounds = root.querySelector("[data-placement-bounds]");
  const serverStatus = root.querySelector("[data-server-status]");
  const aiStatus = root.querySelector("[data-ai-status]");
  const modelStatus = root.querySelector("[data-model-status]");
  const runtimeTitle = root.querySelector("[data-runtime-title]");
  const startupCommand = root.querySelector("[data-startup-command]");
  const startupAction = root.querySelector("[data-startup-action]");
  const runtimeServer = root.querySelector("[data-runtime-server]");
  const runtimeAi = root.querySelector("[data-runtime-ai]");
  const runtimeOverlay = root.querySelector("[data-runtime-overlay]");
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
  let statusSnapshot = {
    server: "checking",
    ai: "checking",
    model: "checking",
    provider: null,
  };
  let readinessSnapshot = {
    permissions: "unknown",
    hooks: {
      codex: "missing",
      claudeCode: "missing",
    },
    promptWatcher: "blocked",
  };
  let overlaySettingsState = "checking";
  let promptDraftTimer = 0;
  let lastNextStepAdvice = null;
  let activeCharacterId = normalizeCharacterId(
    preferenceStore.load().activeCharacterId
  );

  function renderRuntimeReadiness() {
    const readiness = createRuntimeReadiness({
      status: statusSnapshot,
      overlaySettingsState,
    });

    runtimeTitle.textContent = "本機 companion 啟動清單";
    startupCommand.textContent = readiness.primaryCommand;
    startupAction.textContent = readiness.primaryAction;
    stageWorkState.textContent = statusSnapshot.server;
    renderRuntimeStep(runtimeServer, readiness.server);
    renderRuntimeStep(runtimeAi, readiness.ai);
    renderRuntimeStep(runtimeOverlay, readiness.overlay);
    renderGuidedReadiness();
  }

  function renderGuidedReadiness() {
    const readiness = createGuidedReadiness({
      status: statusSnapshot,
      overlaySettingsState,
      permissions: readinessSnapshot.permissions,
      hooks: readinessSnapshot.hooks,
      promptWatcher: readinessSnapshot.promptWatcher,
    });

    guidedReadinessTitle.textContent = readiness.nextItem
      ? readiness.nextItem.label
      : "核心流程已可日用";
    readinessList.replaceChildren(
      ...readiness.items.map((item) => createReadinessElement(item))
    );
  }

  function createReadinessElement(item) {
    const documentRef = root.ownerDocument;
    const article = documentRef.createElement("article");
    const topLine = documentRef.createElement("div");
    const state = documentRef.createElement("span");
    const label = documentRef.createElement("strong");
    const why = documentRef.createElement("p");
    const action = documentRef.createElement("p");
    const meta = documentRef.createElement("p");

    article.className = "readiness-item";
    article.dataset.readinessItem = item.id;
    article.dataset.state = item.state;
    topLine.className = "readiness-item-top";
    state.className = "readiness-state";
    state.textContent = item.state;
    label.textContent = item.label;
    why.textContent = item.why;
    action.textContent = item.action;
    meta.className = "readiness-meta";
    meta.textContent = `${item.retryLabel} · ${item.skipImpact}`;

    topLine.append(state, label);
    article.append(topLine, why, action, meta);

    if (item.command) {
      const command = documentRef.createElement("code");
      command.textContent = item.command;
      article.append(command);
    }

    return article;
  }

  function renderRuntimeStep(element, step) {
    const documentRef = element.ownerDocument;
    const state = documentRef.createElement("span");
    const label = documentRef.createElement("strong");
    const action = documentRef.createElement("span");

    element.dataset.state = step.state;
    state.className = "runtime-step-state";
    state.textContent = step.stateLabel;
    label.textContent = step.label;
    action.textContent = step.action;

    element.replaceChildren(state, label, action);

    if (step.command) {
      const command = documentRef.createElement("code");
      command.textContent = step.command;
      element.append(command);
    }
  }

  function setOverlayInputs(settings) {
    idleSizeInput.value = String(settings.idleSize);
    activeScaleInput.value = String(settings.activeScale);
    wanderSpeedInput.value = String(settings.wanderSpeed);
    safeMarginInput.value = String(settings.safeMargin);
    preferredSideInput.value = normalizePreferredSide(settings.preferredSide);
  }

  function setDefaultOverlayInputs() {
    setOverlayInputs({
      idleSize: 64,
      activeScale: 1,
      wanderSpeed: 1,
      safeMargin: 24,
      preferredSide: "auto",
    });
  }

  function renderCharacters() {
    characterList.replaceChildren(
      ...listCharacterProfiles().map((profile) => createCharacterButton(profile))
    );
  }

  function createCharacterButton(profile) {
    const documentRef = root.ownerDocument;
    const buttonElement = documentRef.createElement("button");
    const name = documentRef.createElement("strong");
    const tagline = documentRef.createElement("span");
    const bias = documentRef.createElement("span");

    buttonElement.type = "button";
    buttonElement.className = "character-option";
    buttonElement.dataset.characterOption = profile.id;
    buttonElement.dataset.selected = String(profile.id === activeCharacterId);
    buttonElement.style.setProperty("--character-accent", profile.theme.accent);
    name.textContent = profile.name;
    tagline.textContent = profile.tagline;
    bias.textContent = profile.coachingBias;
    buttonElement.append(name, tagline, bias);
    buttonElement.addEventListener("click", () => {
      setActiveCharacter(profile.id);
    });

    return buttonElement;
  }

  function setActiveCharacter(characterId) {
    activeCharacterId = normalizeCharacterId(characterId);
    preferenceStore.save({
      ...preferenceStore.load(),
      activeCharacterId,
    });
    renderActiveCharacter();
    renderCharacters();
    renderNextStepAdvice(lastNextStepAdvice);
  }

  function renderActiveCharacter() {
    const profile = getCharacterProfile(activeCharacterId);
    setupRoot.dataset.activeCharacter = profile.id;
    activeCharacterName.textContent = profile.name;
    activeCharacterTagline.textContent = profile.tagline;
    activeCharacterBubble.textContent = `${profile.voice.prefix}先確認 readiness，再接下一步。`;
    stageWorkState.textContent = statusSnapshot.server;
  }

  async function refreshOverlaySettings() {
    try {
      const response = await fetchImpl(overlaySettingsEndpoint);
      if (!response.ok) throw new Error("overlay_settings_failed");
      const payload = await response.json();
      if (payload.settings) {
        setOverlayInputs(payload.settings);
        overlaySettingsStatus.textContent = "已載入目前調校。";
        overlaySettingsState = "loaded";
      } else {
        setDefaultOverlayInputs();
        overlaySettingsStatus.textContent = "無法讀取調校，已使用預設值。";
        overlaySettingsState = "defaulted";
      }
    } catch {
      setDefaultOverlayInputs();
      overlaySettingsStatus.textContent = "無法讀取調校，已使用預設值。";
      overlaySettingsState = "defaulted";
    } finally {
      renderRuntimeReadiness();
    }
  }

  async function refreshStatus() {
    serverStatus.textContent = "checking";
    aiStatus.textContent = "checking";
    modelStatus.textContent = "checking";
    statusSnapshot = {
      server: "checking",
      ai: "checking",
      model: "checking",
      provider: null,
    };
    renderRuntimeReadiness();

    [statusSnapshot, readinessSnapshot] = await Promise.all([
      consoleWorkflow.loadStatus(),
      consoleWorkflow.loadReadinessDiagnostic(),
    ]);
    serverStatus.textContent = statusSnapshot.server;
    aiStatus.textContent = statusSnapshot.ai;
    modelStatus.textContent = statusSnapshot.model;
    renderRuntimeReadiness();
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

      const remainingMs = timeoutMs - (Date.now() - start);
      if (remainingMs <= 0) break;

      await new Promise((resolve) => {
        setTimeout(resolve, Math.min(500, remainingMs));
      });
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

  async function sendPromptDraft(prompt) {
    promptCoachState.textContent = "checking";
    promptCoachStatus.textContent = "分析草稿...";

    try {
      const response = await fetchImpl(eventsEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "prompt:draft",
          source: "console",
          characterId: activeCharacterId,
          prompt,
        }),
      });
      if (!response.ok) throw new Error("prompt_draft_failed");
      const result = await response.json();
      if (!result.accepted) {
        promptCoachState.textContent = "idle";
        promptCoachStatus.textContent = "草稿還不夠具體。";
        return;
      }

      const decision = await consoleWorkflow.loadLatestDecision();
      skillHint.textContent = formatSkillHint(decision?.skillHint);
      renderNextStepAdvice(decision?.nextStepAdvice);
      promptCoachState.textContent = "advice";
      promptCoachStatus.textContent =
        getAdvicePresentation(decision?.nextStepAdvice)?.action ??
        "已產生草稿建議。";
      await refreshSessionSummary();
    } catch {
      promptCoachState.textContent = "error";
      promptCoachStatus.textContent = "無法產生建議，請確認 companion server。";
    }
  }

  function schedulePromptDraft() {
    if (promptDraftTimer) {
      clearTimeout(promptDraftTimer);
      promptDraftTimer = 0;
    }

    const prompt = promptDraftInput.value.replace(/\s+/g, " ").trim();
    if (prompt.length < 18) {
      promptCoachState.textContent = "idle";
      promptCoachStatus.textContent = "等待更完整的草稿。";
      return;
    }

    promptCoachState.textContent = "drafting";
    promptCoachStatus.textContent = "準備建議...";
    promptDraftTimer = setTimeout(() => {
      promptDraftTimer = 0;
      void sendPromptDraft(prompt);
    }, promptDraftDelayMs);
  }

  async function sendTestEvent() {
    testButton.disabled = true;
    lastAiDecision.textContent = "測試中...";

    try {
      if (statusSnapshot.ai === "checking") {
        statusSnapshot = await consoleWorkflow.loadStatus();
        serverStatus.textContent = statusSnapshot.server;
        aiStatus.textContent = statusSnapshot.ai;
        modelStatus.textContent = statusSnapshot.model;
        renderRuntimeReadiness();
      }

      await fetchImpl(eventsEndpoint, { method: "DELETE" });
      const response = await fetchImpl(eventsEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "tool:finish",
          source: "dashboard-hook-test",
          characterId: activeCharacterId,
          tool: "test",
          status: "failed",
        }),
      });
      if (!response.ok) throw new Error("event_failed");

      const decision =
        statusSnapshot.ai === "configured"
          ? await waitForAiDecision({ timeoutMs: aiDecisionTimeoutMs })
          : null;
      lastAiDecision.textContent = decision
        ? `${decision.state} / ${decision.motion}: ${decision.line}`
        : "已送出 hook 測試事件；等待 overlay 反應。";
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
    lastNextStepAdvice = advice;
    if (!advice) {
      nextStepTitle.textContent = "尚未產生建議。";
      nextStepAction.textContent = "等待工作狀態。";
      nextStepReason.textContent = "尚未有足夠脈絡。";
      nextStepPriority.textContent = "low";
      stageNextStep.textContent = "等待工作狀態";
      return;
    }

    const displayedAdvice = ensureCharacterPresentation(advice);
    const presentation = getAdvicePresentation(displayedAdvice);
    nextStepTitle.textContent = String(presentation.title);
    nextStepAction.textContent = String(presentation.action);
    nextStepReason.textContent = String(advice.reason ?? "依目前狀態推測。");
    nextStepPriority.textContent = String(advice.priority ?? "low");
    stageNextStep.textContent = String(advice.title ?? "下一步建議");
  }

  function ensureCharacterPresentation(advice) {
    if (advice?.presentation?.characterId === activeCharacterId) {
      return advice;
    }

    return characterizeAdvice(advice, activeCharacterId);
  }

  function getAdvicePresentation(advice) {
    if (!advice) return null;
    const displayedAdvice = ensureCharacterPresentation(advice);
    return (
      displayedAdvice.presentation ?? {
        title: String(displayedAdvice.title ?? "下一步建議"),
        action: String(displayedAdvice.action ?? "先切一個小步驟。"),
      }
    );
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
  promptDraftInput.addEventListener("input", schedulePromptDraft);
  refreshButton.addEventListener("click", () => {
    void refreshStatus();
    void refreshSessionSummary();
  });
  refreshReadinessButton.addEventListener("click", () => {
    void refreshStatus();
    void refreshOverlaySettings();
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
      overlaySettingsState = "loaded";
      renderRuntimeReadiness();
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

  input.focus({ preventScroll: true });
  renderActiveCharacter();
  renderCharacters();
  renderRuntimeReadiness();
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
  const reason = skillHint.reason
    ? `：${formatCompactReason(skillHint.reason)}`
    : "";

  return `${String(skillHint.skill)}${confidence}${reason}`;
}

function formatCompactReason(reason) {
  const normalized = String(reason ?? "").replace(/\s+/g, " ").trim();
  const firstSentence = normalized.match(/^.*?[。.!?](?:\s|$)/)?.[0]?.trim();
  return firstSentence || normalized.slice(0, 96);
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

function createDefaultPreferenceStore() {
  return createPreferenceStore(globalThis.localStorage ?? createMemoryStorage());
}

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}
