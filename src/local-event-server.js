import http from "node:http";
import { mapEventToState } from "./event-adapter.js";
import { createNextStepAdvice } from "./next-step-advice.js";
import { createSessionSummary } from "./session-summary.js";
import { recommendSkillForTask } from "./skill-recommender.js";

const SAFE_ZONES = ["right-edge", "top-right", "bottom-right", "retreat"];

export function createLocalEventServer({
  classifyEvent = null,
  saveGoogleAiStudioKey = null,
  getSettingsStatus = null,
  getOverlaySettings = null,
  saveOverlaySettings = null,
  analyzeVisionContext = null,
  getPlacementDiagnostic = null,
} = {}) {
  const events = [];
  let nextId = 1;
  let server;

  const requestListener = async (request, response) => {
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
      const decisionEvent = createVisionDecisionEvent(context);
      if (decisionEvent) {
        appendEvent(decisionEvent);
      }
      sendJson(response, 200, { context });
      return;
    }

    if (request.method === "POST" && url.pathname === "/events") {
      const event = await readJson(request);
      const item = appendEvent(event);
      sendJson(response, 202, { accepted: true, id: item.id });

      if (classifyEvent && event.type !== "ai:decision") {
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
    const skillHint = recommendSkillForTask({
      event: sourceEvent,
      recentEvents,
      state: decision.state,
      line: decision.line,
    });

    appendEvent({
      type: "ai:decision",
      sourceEventId,
      skillHint,
      nextStepAdvice: createNextStepAdvice({
        event: sourceEvent,
        recentEvents,
        state: decision.state,
        skillHint,
      }),
      ...decision,
    });
  }

  function appendEvent(event) {
    const item = { id: nextId, event };
    nextId += 1;
    events.push(item);

    return item;
  }
}

function createVisionDecisionEvent(context) {
  if (!context?.suggestedState) {
    return null;
  }

  const state = String(context.suggestedState);
  const safeZone = normalizeSafeZone(context.safeZone);
  const skillHint = recommendSkillForTask({
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
      ? context.visibleSignals.map((signal) => String(signal).slice(0, 80)).slice(0, 6)
      : [],
    ...(safeZone ? { safeZone } : {}),
    skillHint,
  };
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
