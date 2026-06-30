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
import { drawBlob } from "./app.js";
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
const DEFAULT_METRICS_ENDPOINT = "http://127.0.0.1:5174/companion/metrics";
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
    metricsEndpoint = DEFAULT_METRICS_ENDPOINT,
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
            <p class="setup-kicker">Vibe coding 小精靈</p>
            <h1>Codex / Claude Code 低調陪伴</h1>
            <p class="setup-intro" data-dashboard-intro>
              小精靈會在你使用 Codex / Claude Code 時低調陪伴，只有在高信心時提醒可用的 Skill。
            </p>
          </div>
          <button class="ghost-button" data-refresh-status type="button">
            同步狀態
          </button>
        </header>

        <section
          class="companion-stage"
          data-companion-stage
          data-dashboard-section="companion-stage"
        >
          <div class="stage-orb" data-stage-orb aria-hidden="true">
            <canvas
              data-stage-character-canvas
              data-character-id="cosmic-jellyfish"
              width="220"
              height="220"
            ></canvas>
          </div>
          <div class="stage-copy">
            <p class="panel-label">小精靈舞台</p>
            <h2 data-active-character-name>宇宙水母</h2>
            <p class="stage-tagline" data-active-character-tagline>冷靜導航</p>
            <p class="stage-bubble" data-active-character-bubble>
              先確認本機狀態，再切一個小步驟。
            </p>
          </div>
          <div class="stage-status">
            <span data-stage-work-state>檢查中</span>
            <strong data-stage-next-step>本機 companion 啟動清單</strong>
          </div>
        </section>

        <section
          class="live-status-panel"
          data-live-status
          data-dashboard-section="live-status"
        >
          <div>
            <p class="panel-label">Live Status</p>
            <h2>目前偵測</h2>
          </div>
          <dl class="live-status-grid">
            <div>
              <dt>Provider</dt>
              <dd data-live-provider>unknown</dd>
            </div>
            <div>
              <dt>Typing</dt>
              <dd data-live-typing>quiet</dd>
            </div>
            <div>
              <dt>Focus</dt>
              <dd data-live-focus>none</dd>
            </div>
          </dl>
        </section>

        <section
          class="prompt-coach-panel"
          data-prompt-coach-panel
          data-dashboard-section="try-skill-hint"
        >
          <div class="prompt-coach-top">
            <div>
              <p class="panel-label">Try Skill Hint</p>
              <p class="decision-line" data-prompt-coach-status>
                模擬 settled prompt draft，只顯示高信心 Skill。
              </p>
            </div>
            <span class="prompt-coach-state" data-prompt-coach-state>等待</span>
          </div>
          <label class="setup-field prompt-coach-field">
            <span>Skill hint simulator</span>
            <textarea
              data-prompt-draft-input
              rows="4"
              autocomplete="off"
              spellcheck="false"
              placeholder="例如：fix the failing checkout test and find the smallest repro"
            ></textarea>
          </label>
          <section class="polished-prompt-panel" data-polished-prompt-panel hidden>
            <div>
              <p class="panel-label">可直接貼給 Codex</p>
              <p class="polished-prompt" data-polished-prompt></p>
            </div>
            <button
              class="copy-prompt-button"
              data-copy-polished-prompt
              type="button"
              disabled
            >
              複製 prompt
            </button>
          </section>
          <p class="privacy-note" data-privacy-note>
            只會用草稿暫時判斷 Skill；事件紀錄只保留 skill、confidence 和 scenario。
            畫面分析只會在你按下按鈕後做一次，AI key 也可以之後再設定。
          </p>
        </section>

        <section
          class="feedback-metrics-panel"
          data-feedback-metrics
          data-dashboard-section="feedback-metrics"
        >
          <div class="section-heading">
            <div>
              <p class="panel-label">Feedback Metrics</p>
              <h2>本機提醒成效</h2>
            </div>
            <button class="ghost-button" data-refresh-metrics type="button">
              更新
            </button>
          </div>
          <dl class="feedback-grid">
            <div>
              <dt>Shown</dt>
              <dd data-feedback-hints-shown>0</dd>
            </div>
            <div>
              <dt>Helpful</dt>
              <dd data-feedback-helpful-count>0</dd>
            </div>
            <div>
              <dt>Snoozed</dt>
              <dd data-feedback-snoozed-count>0</dd>
            </div>
            <div>
              <dt>Dismissed</dt>
              <dd data-feedback-dismissed-count>0</dd>
            </div>
            <div>
              <dt>Focus</dt>
              <dd data-feedback-focus-count>0</dd>
            </div>
            <div>
              <dt>Typing</dt>
              <dd data-feedback-typing-count>0</dd>
            </div>
          </dl>
          <div class="feedback-actions">
            <button data-feedback-helpful type="button">有幫助</button>
            <button data-feedback-snooze type="button">少提醒</button>
            <button data-feedback-dismiss type="button">知道了</button>
          </div>
        </section>

        <section
          class="skill-panel"
          data-skill-panel
        >
          <div>
            <p class="panel-label">下一步</p>
            <p class="next-step-skill" data-skill-hint>還不用選技能。</p>
            <p class="next-step-title" data-next-step-title>
              先寫一句你想做的東西。
            </p>
            <p class="next-step-action" data-next-step-action>
              我會幫你整理成可直接貼給 Codex 的 prompt。
            </p>
            <p class="next-step-reason" data-next-step-reason>
              目前還沒有足夠脈絡，不會先猜不相關的工具或技能。
            </p>
            <span class="next-step-priority" data-next-step-priority>開始</span>
          </div>
        </section>

        <section
          class="guided-readiness-panel"
          data-guided-readiness
          data-dashboard-section="guided-readiness"
        >
          <div class="section-heading">
            <div>
              <p class="panel-label">新手準備</p>
              <h2 data-guided-readiness-title>檢查第一次使用狀態</h2>
            </div>
            <button class="ghost-button" data-refresh-readiness type="button">
              重新檢查
            </button>
          </div>
          <div class="readiness-list" data-readiness-list></div>
        </section>

        <section
          class="characters-panel"
          data-characters-panel
          data-dashboard-section="characters"
        >
          <div class="section-heading">
            <div>
              <p class="panel-label">Characters</p>
              <h2>選擇今天的小精靈</h2>
            </div>
            <span class="section-note">角色只影響呈現，不改變選中的 Skill。</span>
          </div>
          <div class="character-list" data-character-list></div>
        </section>

        <details
          class="diagnostics-panel"
          data-diagnostics-panel
          data-dashboard-section="diagnostics"
        >
          <summary>
            <span>進階設定</span>
            <small>權限、事件紀錄、AI key 與桌面小精靈調校</small>
          </summary>
          <section class="advanced-readiness-panel" data-advanced-readiness>
            <div class="form-section-header">
              <p class="panel-label">進階檢查</p>
              <p class="section-note">
                Hooks、權限、AI key 與自動讀取都放在這裡，不擋新手先試 prompt。
              </p>
            </div>
            <div class="readiness-list" data-advanced-readiness-list></div>
          </section>
          <section class="runtime-panel" data-runtime-readiness>
            <div class="runtime-panel-header">
              <div>
                <p class="panel-label">本機服務</p>
                <p class="runtime-title" data-runtime-title>檢查本機服務</p>
              </div>
              <code class="runtime-command" data-startup-command>checking</code>
            </div>
            <div class="runtime-steps">
              <div class="runtime-step" data-runtime-server>
                <span class="runtime-step-state">檢查中</span>
                <strong>檢查本機服務</strong>
                <span>正在讀取本機服務狀態。</span>
              </div>
              <div class="runtime-step" data-runtime-ai>
                <span class="runtime-step-state">檢查中</span>
                <strong>檢查 AI key</strong>
                <span>正在讀取 AI 設定。</span>
              </div>
              <div class="runtime-step" data-runtime-overlay>
                <span class="runtime-step-state">檢查中</span>
                <strong>檢查桌面小精靈</strong>
                <span>正在讀取桌面小精靈調校。</span>
              </div>
            </div>
            <p class="runtime-action" data-startup-action>
              正在檢查本機服務啟動狀態。
            </p>
          </section>
          <section class="test-panel" data-test-panel>
            <div>
              <p class="panel-label">測試事件</p>
              <p class="decision-line" data-last-ai-decision>尚未測試。</p>
            </div>
            <button class="test-button" data-send-test-event type="button">
              送測試事件
            </button>
          </section>
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
                <p class="panel-label">工作摘要</p>
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
              <p class="panel-label">畫面分析</p>
              <p class="decision-line" data-vision-context>尚未分析。</p>
            </div>
            <button class="vision-button" data-analyze-screen type="button">
              分析目前畫面
            </button>
          </section>
          <section class="placement-panel" data-placement-panel>
            <div class="placement-header">
              <div>
                <p class="panel-label">定位檢查</p>
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
              <p class="panel-label">桌面小精靈調校</p>
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
  const stageCharacterCanvas = root.querySelector(
    "[data-stage-character-canvas]"
  );
  const stageWorkState = root.querySelector("[data-stage-work-state]");
  const stageNextStep = root.querySelector("[data-stage-next-step]");
  const characterList = root.querySelector("[data-character-list]");
  const readinessList = root.querySelector("[data-readiness-list]");
  const advancedReadinessList = root.querySelector(
    "[data-advanced-readiness-list]"
  );
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
  const liveProvider = root.querySelector("[data-live-provider]");
  const liveTyping = root.querySelector("[data-live-typing]");
  const liveFocus = root.querySelector("[data-live-focus]");
  const refreshMetricsButton = root.querySelector("[data-refresh-metrics]");
  const feedbackHintsShown = root.querySelector("[data-feedback-hints-shown]");
  const feedbackHelpfulCount = root.querySelector(
    "[data-feedback-helpful-count]"
  );
  const feedbackSnoozedCount = root.querySelector(
    "[data-feedback-snoozed-count]"
  );
  const feedbackDismissedCount = root.querySelector(
    "[data-feedback-dismissed-count]"
  );
  const feedbackFocusCount = root.querySelector("[data-feedback-focus-count]");
  const feedbackTypingCount = root.querySelector("[data-feedback-typing-count]");
  const feedbackHelpfulButton = root.querySelector("[data-feedback-helpful]");
  const feedbackSnoozeButton = root.querySelector("[data-feedback-snooze]");
  const feedbackDismissButton = root.querySelector("[data-feedback-dismiss]");
  const polishedPromptPanel = root.querySelector(
    "[data-polished-prompt-panel]"
  );
  const polishedPrompt = root.querySelector("[data-polished-prompt]");
  const copyPolishedPromptButton = root.querySelector(
    "[data-copy-polished-prompt]"
  );
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
  let lastPolishedPrompt = "";
  let lastSkillHint = null;
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
    stageWorkState.textContent = formatStageStatus(statusSnapshot.server);
    renderRuntimeStep(runtimeServer, readiness.server);
    renderRuntimeStep(runtimeAi, readiness.ai);
    renderRuntimeStep(runtimeOverlay, readiness.overlay);
    renderGuidedReadiness();
  }

  function renderGuidedReadiness() {
    const advancedReadiness = createGuidedReadiness({
      status: statusSnapshot,
      overlaySettingsState,
      permissions: readinessSnapshot.permissions,
      hooks: readinessSnapshot.hooks,
      promptWatcher: readinessSnapshot.promptWatcher,
    });
    const beginnerReadiness = createBeginnerReadiness();

    guidedReadinessTitle.textContent = "新手三步驟";
    readinessList.replaceChildren(
      ...beginnerReadiness.map((item) => createReadinessElement(item))
    );
    advancedReadinessList.replaceChildren(
      ...advancedReadiness.items.map((item) =>
        createReadinessElement(item, { advanced: true })
      )
    );
  }

  function createBeginnerReadiness() {
    const serverReady = statusSnapshot.server === "online";
    const promptReady = promptDraftInput.value.replace(/\s+/g, " ").trim()
      .length >= 18;

    return [
      {
        id: "start-companion",
        label: serverReady ? "小精靈服務已啟動" : "啟動小精靈服務",
        state: serverReady ? "ready" : "needs-action",
        why: serverReady
          ? "本機服務已連線，可以接收 prompt 和工作事件。"
          : "先讓本機小精靈服務跑起來，本頁才能同步狀態。",
        action: serverReady
          ? "可以直接輸入想做的東西。"
          : "在終端機執行 npm run companion:start。",
        command: serverReady ? "" : "npm run companion:start",
        retryLabel: "重新檢查",
        skipImpact: "只想先看介面也可以跳過，但自動同步會暫停。",
      },
      {
        id: "pick-character",
        label: "選一隻小精靈",
        state: activeCharacterId ? "ready" : "needs-action",
        why: "不同小精靈會用不同語氣幫你整理下一步。",
        action: `目前是 ${getCharacterProfile(activeCharacterId).name}。`,
        command: "",
        retryLabel: "可隨時切換",
        skipImpact: "不影響功能，只影響陪伴語氣。",
      },
      {
        id: "try-skill-hint",
        label: promptReady ? "Skill hint 模擬已足夠" : "試一段 skill hint 草稿",
        state: promptReady ? "ready" : "needs-action",
        why: "這裡只測試高信心 Skill 推薦，不會幫你改寫 prompt。",
        action: promptReady
          ? "已經可以測試是否出現 skill hint。"
          : "例如：fix the failing checkout test。",
        command: "",
        retryLabel: "輸入後自動檢查",
        skipImpact: "沒有高信心訊號時，overlay 會保持安靜。",
      },
    ];
  }

  function createReadinessElement(item, { advanced = false } = {}) {
    const documentRef = root.ownerDocument;
    const article = documentRef.createElement("article");
    const topLine = documentRef.createElement("div");
    const state = documentRef.createElement("span");
    const label = documentRef.createElement("strong");
    const why = documentRef.createElement("p");
    const action = documentRef.createElement("p");
    const meta = documentRef.createElement("p");

    article.className = "readiness-item";
    if (advanced) {
      article.dataset.advancedReadinessItem = item.id;
    } else {
      article.dataset.readinessItem = item.id;
    }
    article.dataset.state = item.state;
    topLine.className = "readiness-item-top";
    state.className = "readiness-state";
    state.textContent = formatReadinessStateLabel(item.state);
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
    state.textContent = formatRuntimeStateLabel(step.stateLabel);
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
    const preview = documentRef.createElement("canvas");
    const name = documentRef.createElement("strong");
    const tagline = documentRef.createElement("span");
    const bias = documentRef.createElement("span");

    buttonElement.type = "button";
    buttonElement.className = "character-option";
    buttonElement.dataset.characterOption = profile.id;
    buttonElement.dataset.selected = String(profile.id === activeCharacterId);
    buttonElement.setAttribute(
      "aria-pressed",
      String(profile.id === activeCharacterId)
    );
    buttonElement.style.setProperty("--character-accent", profile.theme.accent);
    preview.width = 140;
    preview.height = 140;
    preview.dataset.characterPreviewCanvas = "";
    preview.dataset.characterId = profile.id;
    preview.setAttribute("aria-hidden", "true");
    name.textContent = profile.name;
    tagline.textContent = profile.tagline;
    bias.textContent = formatCharacterBias(profile.coachingBias);
    buttonElement.append(preview, name, tagline, bias);
    drawCharacterCanvas(preview, profile.id, { preview: true });
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
    stageCharacterCanvas.dataset.characterId = profile.id;
    activeCharacterName.textContent = profile.name;
    activeCharacterTagline.textContent = profile.tagline;
    activeCharacterBubble.textContent = getCharacterStarterBubble(profile);
    stageWorkState.textContent = formatStageStatus(statusSnapshot.server);
    drawCharacterCanvas(stageCharacterCanvas, profile.id);
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
    liveProvider.textContent = String(statusSnapshot.provider ?? "unknown");
    liveTyping.textContent = "quiet";
    liveFocus.textContent = statusSnapshot.server === "online" ? "connected" : "none";
    renderRuntimeReadiness();
  }

  async function refreshStatusFromToolbar() {
    refreshButton.disabled = true;
    refreshButton.textContent = "更新中...";

    try {
      await Promise.all([refreshStatus(), refreshSessionSummary()]);
      refreshButton.textContent = "已更新";
    } catch {
      refreshButton.textContent = "更新失敗";
    } finally {
      refreshButton.disabled = false;
    }
  }

  async function refreshReadinessFromToolbar() {
    refreshReadinessButton.disabled = true;
    refreshReadinessButton.textContent = "檢查中...";

    try {
      await Promise.all([refreshStatus(), refreshOverlaySettings()]);
      refreshReadinessButton.textContent = "已檢查";
    } catch {
      refreshReadinessButton.textContent = "檢查失敗";
    } finally {
      refreshReadinessButton.disabled = false;
    }
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

    renderSkillHintDecision(decision);
    if (decision.nextStepAdvice) {
      renderNextStepAdvice(decision.nextStepAdvice);
    }
  }

  async function refreshMetrics() {
    try {
      const response = await fetchImpl(metricsEndpoint);
      if (!response.ok) throw new Error("metrics_failed");
      const payload = await response.json();
      renderMetrics(payload.metrics);
    } catch {
      renderMetrics(null);
    }
  }

  async function sendPromptDraft(prompt) {
    promptCoachState.textContent = "分析中";
    promptCoachStatus.textContent = "正在模擬 Skill hint...";
    clearPolishedPrompt();

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
        promptCoachState.textContent = "等待";
        promptCoachStatus.textContent = "沒有高信心 Skill，先保持安靜。";
        renderNextStepAdvice(null);
        return;
      }

      const decision = await consoleWorkflow.loadLatestDecision();
      renderSkillHintDecision(decision);
      promptCoachState.textContent = "建議";
      promptCoachStatus.textContent = decision?.skillHint?.bubble ??
        "已產生 Skill hint。";
      await refreshMetrics();
      await refreshSessionSummary();
    } catch {
      promptCoachState.textContent = "錯誤";
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
      promptCoachState.textContent = "等待";
      promptCoachStatus.textContent = "輸入一段草稿來測試 Skill hint。";
      clearPolishedPrompt();
      renderNextStepAdvice(null);
      renderGuidedReadiness();
      return;
    }

    promptCoachState.textContent = "整理中";
    promptCoachStatus.textContent = "正在檢查是否有高信心 Skill...";
    clearPolishedPrompt();
    renderGuidedReadiness();
    promptDraftTimer = setTimeout(() => {
      promptDraftTimer = 0;
      void sendPromptDraft(prompt);
    }, promptDraftDelayMs);
  }

  function renderPolishedPrompt(prompt) {
    lastPolishedPrompt = createPolishedPrompt(prompt);
    polishedPrompt.textContent = lastPolishedPrompt;
    polishedPromptPanel.hidden = false;
    copyPolishedPromptButton.disabled = false;
    nextStepTitle.textContent = "把這段 prompt 貼給 Codex。";
    nextStepAction.textContent = "先用小版本完成，再請 Codex 跑測試或開瀏覽器檢查。";
    nextStepReason.textContent = "你的想法已經足夠開始，下一步是讓 agent 有明確範圍。";
    nextStepPriority.textContent = "可用";
    stageNextStep.textContent = "可複製 prompt 已準備好";
  }

  function clearPolishedPrompt() {
    lastPolishedPrompt = "";
    polishedPrompt.textContent = "";
    polishedPromptPanel.hidden = true;
    copyPolishedPromptButton.disabled = true;
  }

  async function copyPolishedPrompt() {
    if (!lastPolishedPrompt) return;

    try {
      if (!globalThis.navigator?.clipboard?.writeText) {
        throw new Error("clipboard_unavailable");
      }
      await globalThis.navigator.clipboard.writeText(lastPolishedPrompt);
      copyPolishedPromptButton.textContent = "已複製";
      promptCoachStatus.textContent = "已複製，可以貼到 Codex 對話框。";
    } catch {
      copyPolishedPromptButton.textContent = "複製 prompt";
      promptCoachStatus.textContent = "無法自動複製，可以直接選取上方文字。";
    }
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

  function renderSkillHintDecision(decision) {
    const hint = decision?.skillHint ?? null;
    lastSkillHint = hint?.skill ? hint : null;
    skillHint.textContent = formatSkillHint(hint);
    updateLiveStatusFromDecision(decision);

    if (!hint?.skill) {
      renderNextStepAdvice(null);
      return;
    }

    const bubble = hint.bubble ?? `先切到合適流程。可用 ${hint.skill}。`;
    nextStepTitle.textContent = bubble;
    nextStepAction.textContent =
      "Overlay 只會顯示這個 Skill 提醒，不改寫或插入 prompt。";
    nextStepReason.textContent = String(
      hint.reason ?? "這是目前最高信心的 Skill。"
    );
    nextStepPriority.textContent = formatPriorityLabel(
      hint.confidence === "high" ? "high" : "low"
    );
    stageNextStep.textContent = bubble;
  }

  function renderMetrics(metrics) {
    feedbackHintsShown.textContent = String(metrics?.hintsShown ?? 0);
    feedbackHelpfulCount.textContent = String(metrics?.helpful ?? 0);
    feedbackSnoozedCount.textContent = String(metrics?.snoozed ?? 0);
    feedbackDismissedCount.textContent = String(metrics?.dismissed ?? 0);
    feedbackFocusCount.textContent = String(metrics?.providerFocusChanges ?? 0);
    feedbackTypingCount.textContent = String(metrics?.promptTypingEvents ?? 0);
  }

  function updateLiveStatusFromDecision(decision) {
    if (!decision) return;
    liveTyping.textContent = decision.state === "typing" ? "typing" : "quiet";
    liveProvider.textContent = String(decision.provider ?? "unknown");
    liveFocus.textContent = String(decision.source ?? "none");
  }

  async function sendHintFeedback(type) {
    if (!lastSkillHint?.skill) return;

    await fetchImpl(eventsEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type,
        skill: String(lastSkillHint.skill),
        source: String(lastSkillHint.source ?? "dashboard"),
        confidence: String(lastSkillHint.confidence ?? "unknown"),
        scenario: String(lastSkillHint.scenario ?? "unknown"),
      }),
    });
    await refreshMetrics();
  }

  function renderNextStepAdvice(advice) {
    lastNextStepAdvice = advice;
    if (!advice) {
      skillHint.textContent = "還不用選技能。";
      nextStepTitle.textContent = "等待高信心 Skill 訊號。";
      nextStepAction.textContent =
        "工作時先讓小精靈觀察，只有高信心時才顯示一個 Skill。";
      nextStepReason.textContent =
        "目前還沒有足夠脈絡，不會先猜不相關的工具或技能。";
      nextStepPriority.textContent = "開始";
      stageNextStep.textContent = "等待高信心 Skill";
      return;
    }

    const displayedAdvice = ensureCharacterPresentation(advice);
    const presentation = getAdvicePresentation(displayedAdvice);
    nextStepTitle.textContent = String(presentation.title);
    nextStepAction.textContent = String(presentation.action);
    nextStepReason.textContent = String(advice.reason ?? "依目前狀態推測。");
    nextStepPriority.textContent = formatPriorityLabel(advice.priority);
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
  copyPolishedPromptButton.addEventListener("click", () => {
    void copyPolishedPrompt();
  });
  refreshMetricsButton.addEventListener("click", () => {
    void refreshMetrics();
  });
  feedbackHelpfulButton.addEventListener("click", () => {
    void sendHintFeedback("companion:hint_helpful");
  });
  feedbackSnoozeButton.addEventListener("click", () => {
    void sendHintFeedback("companion:hint_snoozed");
  });
  feedbackDismissButton.addEventListener("click", () => {
    void sendHintFeedback("companion:hint_dismissed");
  });
  refreshButton.addEventListener("click", () => {
    void refreshStatusFromToolbar();
  });
  refreshReadinessButton.addEventListener("click", () => {
    void refreshReadinessFromToolbar();
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
  renderNextStepAdvice(null);
  renderRuntimeReadiness();
  void refreshStatus();
  void refreshSessionSummary();
  void refreshOverlaySettings();
  void refreshMetrics();

  return {
    root,
    refreshStatus,
    refreshSessionSummary,
    refreshLatestDecision,
    refreshOverlaySettings,
    sendTestEvent,
    analyzeScreenContext,
    refreshPlacementDiagnostic,
    refreshMetrics,
  };
}

function getCharacterStarterBubble(profile) {
  if (profile.id === "foam-ghost") {
    return "慢慢來，我只在訊號夠清楚時提醒一個 Skill。";
  }

  if (profile.id === "green-phosphor-pixel") {
    return "先觀察工作狀態，高信心時再切到合適 Skill。";
  }

  return "我會低調陪你工作，只在高信心時提示 Skill。";
}

function formatCharacterBias(value) {
  const labels = {
    navigation: "導航",
    gentle: "陪伴",
    testing: "測試",
  };

  return labels[String(value)] ?? String(value ?? "小幫手");
}

function createPolishedPrompt(prompt) {
  const idea = String(prompt ?? "").replace(/\s+/g, " ").trim();
  const featureHint = inferFeatureHint(idea);

  return [
    `請幫我把「${idea}」做成一個小而可測的版本。`,
    `請先確認目標和範圍，然後實作最小可用流程：${featureHint}。`,
    "請保持介面可愛、清楚、好上手，避免只做靜態展示。",
    "完成後請跑測試；如果是前端畫面，請用瀏覽器檢查桌面和手機寬度，確認沒有文字重疊或按鈕失效。",
    "最後請告訴我改了哪些檔案、怎麼測、以及本機預覽網址。",
  ].join("\n");
}

function inferFeatureHint(idea) {
  const lower = idea.toLowerCase();
  if (
    lower.includes("番茄鐘") ||
    lower.includes("pomodoro") ||
    lower.includes("tomato")
  ) {
    return "開始、暫停、重設、工作/休息切換，以及目前倒數狀態";
  }

  if (
    lower.includes("dashboard") ||
    lower.includes("儀表板") ||
    lower.includes("管理")
  ) {
    return "主要狀態、核心操作、空狀態和錯誤/載入狀態";
  }

  if (
    lower.includes("app") ||
    lower.includes("網站") ||
    lower.includes("頁面") ||
    lower.includes("介面")
  ) {
    return "第一個畫面、主要操作、互動回饋和基本響應式版面";
  }

  return "核心畫面、主要操作、成功狀態和基本驗證方式";
}

function drawCharacterCanvas(canvas, characterId, { preview = false } = {}) {
  if (!canvas) return;
  if (isJsdomEnvironment()) return;

  drawBlob(canvas, {
    characterId: normalizeCharacterId(characterId),
    mode: "snark",
    mood: "steady",
    motion: { amplitude: preview ? 0.7 : 1 },
    pose: getCharacterPreviewPose(characterId),
    scale: preview ? 0.88 : 1.32,
    state: "coding",
    time: 320,
  });
}

function getCharacterPreviewPose(characterId) {
  const poses = {
    "cosmic-jellyfish": "spark-think",
    "foam-ghost": "idle-wave",
    "green-phosphor-pixel": "work-buddy",
  };

  return poses[normalizeCharacterId(characterId)] ?? "float";
}

function isJsdomEnvironment() {
  return globalThis.navigator?.userAgent?.toLowerCase().includes("jsdom");
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
    return "還不用選技能。";
  }

  const confidence = skillHint.confidence
    ? ` / ${String(skillHint.confidence)}`
    : "";
  const reason = skillHint.reason
    ? `：${formatCompactReason(skillHint.reason)}`
    : "";

  return `${String(skillHint.skill)}${confidence}${reason}`;
}

function formatReadinessStateLabel(state) {
  const labels = {
    ready: "已完成",
    "needs-action": "待處理",
    optional: "可稍後",
    checking: "檢查中",
  };

  return labels[String(state)] ?? String(state ?? "未知");
}

function formatRuntimeStateLabel(state) {
  const labels = {
    ready: "已完成",
    action: "待處理",
    missing: "未設定",
    unknown: "未知",
    fallback: "預設值",
    checking: "檢查中",
  };

  return labels[String(state)] ?? String(state ?? "未知");
}

function formatStageStatus(status) {
  const labels = {
    checking: "檢查中",
    online: "已連線",
    offline: "未連線",
  };

  return labels[String(status)] ?? "檢查中";
}

function formatPriorityLabel(priority) {
  const labels = {
    high: "重要",
    medium: "建議",
    low: "可稍後",
  };

  return labels[String(priority ?? "low")] ?? String(priority ?? "可稍後");
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
