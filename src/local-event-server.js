import http from "node:http";
import { characterizeAdvice } from "./characterized-advice.js";
import { normalizeCharacterId } from "./character-profiles.js";
import { mapEventToState } from "./event-adapter.js";
import { createNextStepAdvice } from "./next-step-advice.js";
import { createPromptDraftAdvice } from "./prompt-advisor.js";
import { createSessionSummary } from "./session-summary.js";
import { recommendSkillForTask } from "./skill-recommender.js";

const SAFE_ZONES = ["right-edge", "top-right", "bottom-right", "retreat"];
const DEFAULT_HINT_COOLDOWN_MS = 8 * 60 * 1000;
const HANDOFF_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);

export function createLocalEventServer({
  classifyEvent = null,
  saveGoogleAiStudioKey = null,
  getSettingsStatus = null,
  getOverlaySettings = null,
  saveOverlaySettings = null,
  analyzeVisionContext = null,
  getPlacementDiagnostic = null,
  getReadinessDiagnostic = null,
  loadInstalledSkills = null,
  getNow = () => Date.now(),
  hintCooldownMs = DEFAULT_HINT_COOLDOWN_MS,
  allowedOrigins = DEFAULT_ALLOWED_ORIGINS,
} = {}) {
  const events = [];
  const metrics = {
    hintsShown: 0,
    helpful: 0,
    snoozed: 0,
    dismissed: 0,
    providerFocusChanges: 0,
    promptTypingEvents: 0,
  };
  const snoozedHints = new Set();
  const recentShownHints = new Map();
  const failedTestTimes = [];
  const shownHandoffs = new Set();
  let nextId = 1;
  let server;
  let activeProvider = "";
  let lastMeaningfulSignal = null;

  const requestListener = async (request, response) => {
    const origin = request.headers.origin;
    if (!isAllowedOrigin(origin, allowedOrigins)) {
      sendJson(response, 403, { error: "origin_not_allowed" });
      return;
    }

    setCorsHeaders(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url, "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/healthz") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && url.pathname === "/settings/status") {
      sendJson(response, 200, {
        ok: true,
        ...(getSettingsStatus?.() ?? {
          aiConfigured: false,
          provider: null,
          model: null,
        }),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/settings/overlay") {
      sendJson(response, 200, {
        settings: getOverlaySettings ? await getOverlaySettings() : null,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/companion/metrics") {
      sendJson(response, 200, { metrics: { ...metrics } });
      return;
    }

    if (request.method === "GET" && url.pathname === "/placement/diagnostic") {
      if (!getPlacementDiagnostic) {
        sendJson(response, 503, { error: "placement_diagnostic_unavailable" });
        return;
      }

      const diagnostic = await getPlacementDiagnostic({
        state: String(url.searchParams.get("state") ?? "waiting"),
        safeZone: String(url.searchParams.get("safeZone") ?? "right-edge"),
        settingsOverride: createPlacementSettingsOverride(url),
      });
      sendJson(response, 200, diagnostic);
      return;
    }

    if (request.method === "GET" && url.pathname === "/readiness/diagnostic") {
      if (!getReadinessDiagnostic) {
        sendJson(response, 503, { error: "readiness_diagnostic_unavailable" });
        return;
      }

      sendJson(response, 200, await getReadinessDiagnostic());
      return;
    }

    if (request.method === "POST" && url.pathname === "/settings/overlay") {
      if (!saveOverlaySettings) {
        sendJson(response, 503, { error: "overlay_settings_writer_unavailable" });
        return;
      }

      const settings = await saveOverlaySettings(await readJson(request));
      sendJson(response, 200, { saved: true, settings });
      return;
    }

    if (request.method === "POST" && url.pathname === "/vision/context") {
      if (!analyzeVisionContext) {
        sendJson(response, 503, { error: "vision_analyzer_unavailable" });
        return;
      }

      const payload = await readJson(request);
      const context = await analyzeVisionContext({
        imageDataUrl: payload.imageDataUrl,
      });
      const decisionEvent = await createVisionDecisionEvent(context);
      if (decisionEvent) {
        appendEvent(decisionEvent);
      }
      sendJson(response, 200, { context });
      return;
    }

    if (request.method === "POST" && url.pathname === "/events") {
      const event = await readJson(request);
      if (event?.type === "prompt:draft") {
        const result = await appendPromptDraftDecision(event);
        if (!result.item) {
          sendJson(response, 202, {
            accepted: false,
            reason: result.reason,
          });
          return;
        }

        sendJson(response, 202, { accepted: true, id: result.item.id });
        return;
      }

      const storedEvent = sanitizeEventForStorage(event);
      const item = appendEvent(storedEvent);
      observeStoredEvent(storedEvent);
      sendJson(response, 202, { accepted: true, id: item.id });

      if (storedEvent.type === "agent:focus") {
        const handoffDecision = createHandoffDecision(storedEvent);
        if (handoffDecision) {
          appendDecisionEvent(handoffDecision);
        }
        return;
      }

      if (
        classifyEvent &&
        ![
          "ai:decision",
          "agent:focus",
          "prompt:typing",
          "companion:hint_shown",
          "companion:hint_helpful",
          "companion:hint_snoozed",
          "companion:hint_dismissed",
        ].includes(String(event.type ?? ""))
      ) {
        void classifyAndAppendDecision({
          sourceEvent: event,
          sourceEventId: item.id,
        });
      }

      return;
    }

    if (request.method === "POST" && url.pathname === "/settings/google-ai-key") {
      const payload = await readJson(request);
      const apiKey = String(payload.apiKey ?? "").trim();
      const model = String(payload.model ?? "gemma-4-31b-it").trim();

      if (!apiKey || apiKey.includes("\n") || apiKey.includes("\r")) {
        sendJson(response, 400, { error: "invalid_api_key" });
        return;
      }

      if (!saveGoogleAiStudioKey) {
        sendJson(response, 503, { error: "settings_writer_unavailable" });
        return;
      }

      await saveGoogleAiStudioKey({ apiKey, model });
      sendJson(response, 200, {
        saved: true,
        provider: "google",
        model,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/events") {
      const since = Number(url.searchParams.get("since") ?? 0);

      sendJson(response, 200, {
        events: events.filter((item) => item.id > since),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/session/summary") {
      sendJson(response, 200, {
        summary: createSessionSummary(events),
      });
      return;
    }

    if (request.method === "DELETE" && url.pathname === "/events") {
      events.length = 0;
      resetTransientState();
      sendJson(response, 200, { cleared: true });
      return;
    }

    sendJson(response, 404, { error: "not_found" });
  };

  return {
    listen(port, host = "127.0.0.1") {
      server = http.createServer(requestListener);

      return new Promise((resolve) => {
        server.listen(port, host, resolve);
      });
    },
    url() {
      const address = server.address();
      return `http://${address.address}:${address.port}`;
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };

  async function classifyAndAppendDecision({ sourceEvent, sourceEventId }) {
    let decision;

    try {
      decision = await classifyEvent({
        event: sourceEvent,
        recentEvents: events.map((item) => item.event).slice(-8),
        fallbackState: mapEventToState(sourceEvent),
      });
    } catch {
      return;
    }

    if (!decision?.state) {
      return;
    }

    const recentEvents = events.map((item) => item.event).slice(-8);
    const skillHint = await recommendFromInstalledSkills({
      event: sourceEvent,
      recentEvents,
      state: decision.state,
      line: decision.line,
    });
    const characterId = sourceEvent.characterId
      ? normalizeCharacterId(sourceEvent.characterId)
      : null;
    const nextStepAdvice = createNextStepAdvice({
      event: sourceEvent,
      recentEvents,
      state: decision.state,
      skillHint,
    });

    appendDecisionEvent({
      type: "ai:decision",
      sourceEventId,
      skillHint,
      ...(characterId ? { characterId } : {}),
      nextStepAdvice: characterId
        ? characterizeAdvice(nextStepAdvice, characterId)
        : nextStepAdvice,
      ...decision,
    });
  }

  function appendEvent(event) {
    const item = { id: nextId, event };
    nextId += 1;
    events.push(item);

    return item;
  }

  function appendDecisionEvent(event) {
    const item = appendEvent(event);
    observeStoredEvent(event);
    recordHintShown(event.skillHint);
    return item;
  }

  function resetTransientState() {
    metrics.hintsShown = 0;
    metrics.helpful = 0;
    metrics.snoozed = 0;
    metrics.dismissed = 0;
    metrics.providerFocusChanges = 0;
    metrics.promptTypingEvents = 0;
    snoozedHints.clear();
    recentShownHints.clear();
    failedTestTimes.length = 0;
    shownHandoffs.clear();
    activeProvider = "";
    lastMeaningfulSignal = null;
  }

  async function appendPromptDraftDecision(event) {
    const decisionEvent = await createPromptDraftDecisionEvent(event);
    if (!decisionEvent) {
      if (isSettledDraftLongEnough(event.prompt)) {
        appendEvent({
          type: "prompt:stuck",
          source: "prompt-draft",
          ...(event.provider ? { provider: normalizeProvider(event.provider) } : {}),
        });
      }
      return { item: null, reason: "draft_not_actionable" };
    }
    if (!isHintAllowed(decisionEvent.skillHint)) {
      return { item: null, reason: "hint_suppressed" };
    }

    return { item: appendDecisionEvent(decisionEvent), reason: "" };
  }

  async function createPromptDraftDecisionEvent(event = {}) {
    const skills = await getInstalledSkills();
    const advice = createPromptDraftAdvice({
      prompt: event.prompt,
      skills,
      characterId: event.characterId,
    });
    const workOverride = createWorkEventSkillHintOverride();
    if (!advice && !workOverride) return null;

    const skillHint = workOverride ?? advice.skillHint;
    return {
      type: "ai:decision",
      source: "prompt:draft",
      state: "thinking",
      intensity: "medium",
      motion: "point",
      line: skillHint.bubble,
      ...(skillHint.characterId
        ? { characterId: skillHint.characterId }
        : {}),
      skillHint,
    };
  }

  function observeStoredEvent(event = {}) {
    const now = getNow();
    pruneRecentTracking(now);

    if (event.type === "prompt:typing") {
      metrics.promptTypingEvents += 1;
      return;
    }

    if (event.type === "agent:focus") {
      metrics.providerFocusChanges += 1;
      return;
    }

    if (isFeedbackEvent(event)) {
      recordFeedbackEvent(event);
      return;
    }

    if (event.type === "tool:finish" && event.tool === "test" && event.status === "failed") {
      failedTestTimes.push(now);
      if (failedTestTimes.length >= 2) {
        recordMeaningfulSignal({
          provider: activeProvider,
          state: "error",
          skillHint: createWorkEventSkillHintOverride(),
        });
      }
      return;
    }

    if (
      event.type === "ai:decision" &&
      event.source !== "handoff" &&
      event.skillHint?.confidence === "high"
    ) {
      recordMeaningfulSignal({
        provider: event.provider ?? activeProvider,
        state: event.state,
        skillHint: event.skillHint,
      });
    }
  }

  function recordFeedbackEvent(event = {}) {
    if (event.type === "companion:hint_shown") metrics.hintsShown += 1;
    if (event.type === "companion:hint_helpful") metrics.helpful += 1;
    if (event.type === "companion:hint_dismissed") metrics.dismissed += 1;
    if (event.type === "companion:hint_snoozed") {
      metrics.snoozed += 1;
      const skill = String(event.skill ?? "").trim();
      const scenario = String(event.scenario ?? "").trim();
      if (skill) snoozedHints.add(`skill:${skill}`);
      if (scenario) snoozedHints.add(`scenario:${scenario}`);
    }
  }

  function recordHintShown(skillHint = {}) {
    if (!skillHint?.skill || skillHint.confidence !== "high") return;
    metrics.hintsShown += 1;
    recentShownHints.set(hintCooldownKey(skillHint), getNow());
  }

  function recordMeaningfulSignal({ provider, state, skillHint }) {
    if (!skillHint?.skill || skillHint.confidence !== "high") return;
    lastMeaningfulSignal = {
      provider: String(provider ?? "").trim(),
      state: String(state ?? "unknown"),
      skillHint,
      at: getNow(),
    };
  }

  function createHandoffDecision(event = {}) {
    const provider = String(event.provider ?? "").trim();
    if (!provider) return null;

    const previousProvider = activeProvider;
    if (!previousProvider) {
      activeProvider = provider;
      return null;
    }

    activeProvider = provider;
    if (provider === previousProvider) return null;
    if (!lastMeaningfulSignal || lastMeaningfulSignal.provider !== previousProvider) {
      return null;
    }
    if (getNow() - lastMeaningfulSignal.at > HANDOFF_WINDOW_MS) {
      return null;
    }

    const skillHint = lastMeaningfulSignal.skillHint;
    const scenario = String(skillHint.scenario ?? scenarioForSkill(skillHint.skill));
    const handoffKey = `${previousProvider}->${provider}:${skillHint.skill}:${scenario}`;
    if (shownHandoffs.has(handoffKey)) return null;
    shownHandoffs.add(handoffKey);

    const fromLabel = providerLabel(previousProvider);
    const category = categoryLabelForScenario(scenario);
    const bubble = `剛才在 ${fromLabel} 做 ${category}。${baseBubbleForSkill(skillHint.skill)}`;

    return {
      type: "ai:decision",
      source: "handoff",
      state: "thinking",
      intensity: "medium",
      motion: "point",
      line: bubble,
      skillHint: {
        skill: String(skillHint.skill),
        confidence: "high",
        reason: `剛才在 ${fromLabel} 有明確 ${category} 工作脈絡。`,
        source: "handoff",
        scenario,
        bubble,
      },
    };
  }

  function createWorkEventSkillHintOverride() {
    pruneRecentTracking(getNow());
    if (failedTestTimes.length < 2) return null;

    return {
      skill: "diagnose",
      confidence: "high",
      reason: "最近測試連續失敗，工作事件優先於草稿內容。",
      source: "work-event",
      scenario: "bug",
      bubble: "先縮小錯誤範圍。可用 diagnose。",
    };
  }

  function isHintAllowed(skillHint = {}) {
    if (!skillHint?.skill || skillHint.confidence !== "high") return false;
    const skill = String(skillHint.skill);
    const scenario = String(skillHint.scenario ?? scenarioForSkill(skill));
    if (snoozedHints.has(`skill:${skill}`) || snoozedHints.has(`scenario:${scenario}`)) {
      return false;
    }

    const lastShownAt = recentShownHints.get(hintCooldownKey(skillHint));
    return !lastShownAt || getNow() - lastShownAt >= hintCooldownMs;
  }

  function pruneRecentTracking(now) {
    while (failedTestTimes.length && now - failedTestTimes[0] > HANDOFF_WINDOW_MS) {
      failedTestTimes.shift();
    }
  }

  async function createVisionDecisionEvent(context) {
    if (!context?.suggestedState) {
      return null;
    }

    const state = String(context.suggestedState);
    const safeZone = normalizeSafeZone(context.safeZone);
    const skillHint = await recommendFromInstalledSkills({
      activity: context.activity,
      suggestedState: state,
      visibleSignals: context.visibleSignals,
    });

    return {
      type: "ai:decision",
      source: "vision:context",
      state,
      intensity: intensityForConfidence(context.confidence),
      motion: motionForState(state),
      line: String(context.activity ?? "").slice(0, 180),
      visibleSignals: Array.isArray(context.visibleSignals)
        ? context.visibleSignals
            .map((signal) => String(signal).slice(0, 80))
            .slice(0, 6)
        : [],
      ...(safeZone ? { safeZone } : {}),
      skillHint,
    };
  }

  async function recommendFromInstalledSkills(context) {
    return recommendSkillForTask(context, { skills: await getInstalledSkills() });
  }

  async function getInstalledSkills() {
    if (!loadInstalledSkills) return [];
    try {
      return await loadInstalledSkills();
    } catch {
      return [];
    }
  }
}

function createPlacementSettingsOverride(url) {
  const preferredSide = String(url.searchParams.get("preferredSide") ?? "");

  if (["auto", "left", "right"].includes(preferredSide)) {
    return { preferredSide };
  }

  return {};
}

function normalizeSafeZone(safeZone) {
  const value = String(safeZone ?? "").trim();
  return SAFE_ZONES.includes(value) ? value : "";
}

function sanitizeEventForStorage(event = {}) {
  if (event?.type === "prompt:typing") {
    return {
      type: "prompt:typing",
      ...(event.source ? { source: String(event.source) } : {}),
      ...(event.provider ? { provider: String(event.provider) } : {}),
      ...(event.appName ? { appName: String(event.appName) } : {}),
      ...(event.windowTitle ? { windowTitle: String(event.windowTitle) } : {}),
      ...(event.timestamp ? { timestamp: event.timestamp } : {}),
    };
  }

  if (event?.type === "agent:focus") {
    return {
      type: "agent:focus",
      provider: normalizeProvider(event.provider),
      ...(event.appName ? { appName: String(event.appName) } : {}),
      ...(event.windowTitle ? { windowTitle: String(event.windowTitle) } : {}),
      ...(event.timestamp ? { timestamp: event.timestamp } : {}),
    };
  }

  if (isFeedbackEvent(event)) {
    return {
      type: String(event.type),
      ...(event.skill ? { skill: String(event.skill) } : {}),
      ...(event.source ? { source: String(event.source) } : {}),
      ...(event.confidence ? { confidence: String(event.confidence) } : {}),
      ...(event.scenario ? { scenario: String(event.scenario) } : {}),
      ...(event.timestamp ? { timestamp: event.timestamp } : {}),
    };
  }

  return event;
}

function isFeedbackEvent(event = {}) {
  return [
    "companion:hint_shown",
    "companion:hint_helpful",
    "companion:hint_snoozed",
    "companion:hint_dismissed",
  ].includes(String(event.type ?? ""));
}

function normalizeProvider(provider) {
  const value = String(provider ?? "").trim().toLowerCase();
  if (value === "claude" || value === "claude-code") return "claude-code";
  if (value === "codex") return "codex";
  return value;
}

function isSettledDraftLongEnough(prompt) {
  return String(prompt ?? "").replace(/\s+/g, " ").trim().length >= 18;
}

function hintCooldownKey(skillHint = {}) {
  return [
    String(skillHint.source ?? "unknown"),
    String(skillHint.skill ?? ""),
    String(skillHint.scenario ?? scenarioForSkill(skillHint.skill)),
  ].join(":");
}

function scenarioForSkill(skill) {
  const scenarios = {
    diagnose: "bug",
    "frontend-design": "ui",
    tdd: "test",
    prototype: "prototype",
    "write-a-prd": "planning",
    "openai-docs": "docs",
  };

  return scenarios[String(skill ?? "")] ?? "unknown";
}

function providerLabel(provider) {
  const labels = {
    codex: "Codex",
    "claude-code": "Claude",
  };

  return labels[String(provider ?? "")] ?? String(provider ?? "agent");
}

function categoryLabelForScenario(scenario) {
  const labels = {
    ui: "UI",
    bug: "bug",
    test: "test",
    planning: "planning",
    prototype: "prototype",
    docs: "docs",
    implementation: "implementation",
  };

  return labels[String(scenario ?? "")] ?? "工作";
}

function baseBubbleForSkill(skill) {
  const bubbles = {
    diagnose: "先縮小錯誤範圍。可用 diagnose。",
    "frontend-design": "先檢查畫面狀態。可用 frontend-design。",
    tdd: "先切一個小測試。可用 tdd。",
    prototype: "先做可玩原型。可用 prototype。",
    "write-a-prd": "先整理需求範圍。可用 write-a-prd。",
    "openai-docs": "先查官方文件。可用 openai-docs。",
  };

  const value = String(skill ?? "").trim();
  return bubbles[value] ?? `先切到合適流程。可用 ${truncateSkillName(value)}。`;
}

function truncateSkillName(skill) {
  const value = String(skill ?? "").trim();
  return value.length > 28 ? `${value.slice(0, 27)}…` : value;
}

function intensityForConfidence(confidence) {
  const value = Number(confidence);

  if (value >= 0.75) return "high";
  if (value >= 0.45) return "medium";
  return "low";
}

function motionForState(state) {
  const motions = {
    idle: "wander",
    waiting: "wander",
    thinking: "observe",
    reading: "observe",
    coding: "work",
    testing: "work",
    error: "panic",
    debugging: "panic",
    success: "celebrate",
  };

  return motions[state] ?? "observe";
}

function setCorsHeaders(response) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
}

function isAllowedOrigin(origin, allowedOrigins) {
  return !origin || allowedOrigins.has(origin);
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}
