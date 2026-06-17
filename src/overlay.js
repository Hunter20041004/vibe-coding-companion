import { createAgentState } from "./agent-state.js";
import { createEventAdapter } from "./event-adapter.js";
import { createEventPoller } from "./event-poller.js";
import { getBlobFrame } from "./animation-model.js";
import { drawBlob } from "./app.js";
import {
  COMPANION_LIGHT_TONES,
  createCompanionWorkInterpreter,
} from "./companion-work.js";
import {
  DEFAULT_OVERLAY_SETTINGS,
  normalizeOverlaySettings,
} from "./overlay-settings-values.js";

export function mountOverlay(root, options = {}) {
  if (!root) {
    throw new Error("mountOverlay requires a root element.");
  }

  const agentState = createAgentState();
  let vibe = 62;
  let scale = 1.2;
  let overlaySettings = { ...DEFAULT_OVERLAY_SETTINGS };
  let reaction = { intensity: "medium", motion: "wander", line: "" };
  let animationFrame = 0;
  let settingsTimer = 0;
  let transientTimer = 0;
  let speechTimer = 0;
  const workInterpreter =
    options.workInterpreter ??
    createCompanionWorkInterpreter({
      initialVibe: vibe,
      initialReaction: reaction,
      ...(options.brain ? { brain: options.brain } : {}),
      ...(options.workContextTracker
        ? { workContextTracker: options.workContextTracker }
        : {}),
    });

  root.innerHTML = `
    <section class="codex-overlay" data-overlay-root data-overlay-state="idle" aria-label="Codex companion overlay">
      <div class="overlay-drag-strip" data-overlay-drag>
        <span class="status-light" data-status-light data-tone="${COMPANION_LIGHT_TONES.idle}"></span>
        <span class="state-label" data-agent-state>idle</span>
        <button class="overlay-close" type="button" data-overlay-close aria-label="關閉 overlay">x</button>
      </div>
      <p class="dialogue-bubble" data-dialogue-bubble hidden></p>
      <canvas data-character-canvas width="220" height="220"></canvas>
    </section>
  `;

  const stateLabel = root.querySelector("[data-agent-state]");
  const overlayRoot = root.querySelector("[data-overlay-root]");
  const statusLight = root.querySelector("[data-status-light]");
  const characterCanvas = root.querySelector("[data-character-canvas]");
  const dialogueBubble = root.querySelector("[data-dialogue-bubble]");
  const closeButton = root.querySelector("[data-overlay-close]");

  function applyOverlaySettings(settings) {
    overlaySettings = normalizeOverlaySettings(settings);
    scale = 1.2 * overlaySettings.activeScale;
    overlayRoot.dataset.idleSize = String(overlaySettings.idleSize);
    overlayRoot.dataset.activeScale = String(overlaySettings.activeScale);
    characterCanvas.style.setProperty(
      "--idle-canvas-size",
      `${overlaySettings.idleSize}px`
    );
    characterCanvas.style.setProperty(
      "--active-canvas-size",
      `${Math.round(118 * overlaySettings.activeScale)}px`
    );
  }

  async function pollSettingsOnce() {
    const settingsUrl = options.settingsUrl ?? "http://127.0.0.1:5174/settings/overlay";
    if (!settingsUrl) return null;
    const response = await (options.fetchImpl ?? fetch)(settingsUrl);
    if (!response.ok) return null;
    const payload = await response.json();
    if (payload.settings) {
      applyOverlaySettings(payload.settings);
    }
    return payload.settings ?? null;
  }

  const setState = (nextState, event = {}) => {
    if (transientTimer) {
      clearTimeout(transientTimer);
      transientTimer = 0;
    }
    const state = agentState.set(nextState);
    const packet = workInterpreter.observeState(state, event);

    reaction = packet.reaction;
    stateLabel.textContent = state;
    overlayRoot.dataset.overlayState = state;
    statusLight.dataset.tone = packet.lightTone;
    overlayRoot.dataset.aiIntensity = reaction.intensity;
    overlayRoot.dataset.aiMotion = reaction.motion;
    overlayRoot.dataset.aiLine = reaction.line;
    const brainReaction = packet.brainReaction;
    overlayRoot.dataset.companionGesture = brainReaction.gesture;
    updateDialogueBubble(dialogueBubble, brainReaction);
    if (speechTimer) {
      clearTimeout(speechTimer);
      speechTimer = 0;
    }
    if (!brainReaction.quiet && brainReaction.ttlMs > 0) {
      speechTimer = setTimeout(() => {
        speechTimer = 0;
        updateDialogueBubble(dialogueBubble, {
          quiet: true,
          speech: "",
        });
      }, brainReaction.ttlMs);
    }
    vibe = packet.vibe;
    if (isTransientState(state)) {
      transientTimer = setTimeout(() => {
        transientTimer = 0;
        setState("waiting", { type: "transient:settled" });
      }, options.transientMs ?? 1600);
    }

    return state;
  };

  const eventAdapter = createEventAdapter(setState);
  const sendEvent = (event) => eventAdapter.sendEvent(event);
  const eventUrl = options.eventUrl ?? "http://127.0.0.1:5174/events";
  const eventPoller = eventUrl
    ? createEventPoller({
        eventUrl,
        fetchImpl: options.fetchImpl,
        intervalMs: options.pollIntervalMs ?? 600,
        onEvent: sendEvent,
      })
    : null;

  closeButton.addEventListener("click", () => {
    globalThis.close?.();
  });

  function drawLoop(time = 0) {
    drawBlob(characterCanvas, {
      ...getBlobFrame({
        state: agentState.current(),
        vibe,
        baseScale: scale,
        anchor: { x: 0, y: 0 },
        time,
        mode: "snark",
        reaction,
      }),
      mode: "snark",
      state: agentState.current(),
      time,
    });

    animationFrame = requestAnimationFrame(drawLoop);
  }

  if (typeof requestAnimationFrame === "function" && !isJsdomEnvironment()) {
    animationFrame = requestAnimationFrame(drawLoop);
  }

  if (eventPoller && !isJsdomEnvironment()) {
    eventPoller.start();
  }
  applyOverlaySettings(overlaySettings);
  if (!isJsdomEnvironment()) {
    void pollSettingsOnce();
    settingsTimer = setInterval(() => {
      void pollSettingsOnce();
    }, options.settingsPollIntervalMs ?? 3000);
  }

  return {
    setState,
    sendEvent,
    pollSettingsOnce,
    pollEventsOnce() {
      return eventPoller?.pollOnce();
    },
    destroy() {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      if (settingsTimer) {
        clearInterval(settingsTimer);
      }
      if (transientTimer) {
        clearTimeout(transientTimer);
      }
      if (speechTimer) {
        clearTimeout(speechTimer);
      }
      eventPoller?.stop();
    },
  };
}

function isTransientState(state) {
  return state === "error" || state === "success";
}

function isJsdomEnvironment() {
  return globalThis.navigator?.userAgent?.toLowerCase().includes("jsdom");
}

function updateDialogueBubble(bubble, brainReaction = {}) {
  const text = brainReaction.quiet ? "" : truncateDialogue(brainReaction.speech);
  bubble.textContent = text;
  bubble.hidden = !text;
}

function truncateDialogue(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > 42 ? `${text.slice(0, 41)}…` : text;
}

if (typeof document !== "undefined") {
  const root = document.querySelector("#overlay");

  if (root) {
    mountOverlay(root, {
      eventUrl: import.meta.env?.VITE_COMPANION_EVENT_URL,
      settingsUrl: import.meta.env?.VITE_COMPANION_SETTINGS_URL,
    });
  }
}
