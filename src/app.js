import { createAgentState } from "./agent-state.js";
import { AGENT_STATES } from "./agent-state.js";
import { createDemoFlow } from "./demo-flow.js";
import { getStatusCopy } from "./status-copy.js";
import { createPreferenceStore } from "./preferences.js";
import { getBlobFrame } from "./animation-model.js";
import { createEventAdapter } from "./event-adapter.js";
import { createEventPoller } from "./event-poller.js";
import {
  COMPANION_LIGHT_TONES,
  createCompanionWorkInterpreter,
} from "./companion-work.js";
import {
  getCharacterProfile,
  normalizeCharacterId,
} from "./character-profiles.js";

export function mountApp(root, options = {}) {
  if (!root) {
    throw new Error("mountApp requires a root element.");
  }

  const agentState = createAgentState();
  const storage = options.storage ?? globalThis.localStorage;
  const preferenceStore = storage ? createPreferenceStore(storage) : null;
  const preferences = preferenceStore?.load() ?? {
    anchor: { x: 50, y: 46 },
    scale: 1,
    mode: "calm",
  };
  let mode = preferences.mode;
  let scale = preferences.scale;
  let anchor = preferences.anchor;
  let vibe = 62;
  let animationFrame = 0;
  let reaction = { intensity: "medium", motion: "wander", line: "" };
  const workInterpreter =
    options.workInterpreter ??
    createCompanionWorkInterpreter({
      initialVibe: vibe,
      initialReaction: reaction,
    });

  root.innerHTML = `
    <section class="companion" aria-label="Vibe coding companion overlay">
      <header class="topbar">
        <p class="eyebrow">Vibe coding companion overlay</p>
        <p data-agent-state>idle</p>
      </header>
      <div
        class="character-stage"
        data-character-stage
        data-scale="${scale}"
        data-anchor-x="${anchor.x}"
        data-anchor-y="${anchor.y}"
      >
        <canvas data-character-canvas width="220" height="220"></canvas>
      </div>
      <div class="status-row">
        <span class="status-light" data-status-light data-tone="${COMPANION_LIGHT_TONES.idle}"></span>
        <p class="status-line" data-status-line>${getStatusCopy("idle", mode)}</p>
      </div>
      <section class="vibe-meter" aria-label="Vibe Meter" data-vibe-meter style="--vibe: ${vibe}%">
        <div class="meter-top">
          <p class="meter-label">Vibe Meter</p>
          <output data-vibe-output>${vibe}</output>
        </div>
        <div class="meter-track">
          <div class="meter-fill"></div>
        </div>
      </section>
      <div class="hud">
        <div class="mode-control" aria-label="模式" data-mode-control>
          <button type="button" data-mode-option="calm">Calm</button>
          <button type="button" data-mode-option="snark">Snark</button>
          <button type="button" data-mode-option="showcase">Showcase</button>
        </div>
        <button class="start-button" type="button" data-start-session>開始</button>
      </div>
      <section class="debug-panel" data-debug-panel>
        <h2>開發控制</h2>
        <div class="state-grid">
          ${AGENT_STATES.map(
            (state) => `<button type="button" data-debug-state="${state}">${state}</button>`
          ).join("")}
        </div>
        <label>
          角色大小
          <input
            type="range"
            min="0.6"
            max="1.8"
            step="0.1"
            value="${scale}"
            data-scale-control
          />
        </label>
        <label>
          Vibe
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value="${vibe}"
            data-vibe-control
          />
        </label>
        <button type="button" data-reset-position>重置位置</button>
        <section class="event-bridge" aria-label="事件橋接" data-event-bridge>
          <h3>事件橋接</h3>
          <div class="event-grid">
            <button type="button" data-event-trigger="prompt">Prompt</button>
            <button type="button" data-event-trigger="read">Read</button>
            <button type="button" data-event-trigger="edit">Edit</button>
            <button type="button" data-event-trigger="test">Test</button>
            <button type="button" data-event-trigger="test-failed">測試失敗</button>
            <button type="button" data-event-trigger="test-passed">測試通過</button>
            <button type="button" data-event-trigger="complete">Complete</button>
          </div>
          <p class="event-last" data-event-last>Last event: none</p>
        </section>
      </section>
    </section>
  `;

  const stateLabel = root.querySelector("[data-agent-state]");
  stateLabel.className = "state-label";
  const statusLine = root.querySelector("[data-status-line]");
  const statusLight = root.querySelector("[data-status-light]");
  const startButton = root.querySelector("[data-start-session]");
  const modeButtons = root.querySelectorAll("[data-mode-option]");
  const characterStage = root.querySelector("[data-character-stage]");
  const characterCanvas = root.querySelector("[data-character-canvas]");
  const scaleControl = root.querySelector("[data-scale-control]");
  const vibeMeter = root.querySelector("[data-vibe-meter]");
  const vibeControl = root.querySelector("[data-vibe-control]");
  const vibeOutput = root.querySelector("[data-vibe-output]");
  const resetPosition = root.querySelector("[data-reset-position]");
  const debugButtons = root.querySelectorAll("[data-debug-state]");
  const eventButtons = root.querySelectorAll("[data-event-trigger]");
  const lastEvent = root.querySelector("[data-event-last]");
  let isDragging = false;

  const savePreferences = () => {
    preferenceStore?.save({ anchor, scale, mode });
  };

  const setState = (nextState, event = {}) => {
    const state = agentState.set(nextState);
    const packet = workInterpreter.observeState(state, event);

    reaction = packet.reaction;
    stateLabel.textContent = state;
    statusLine.textContent = reaction.line || getStatusCopy(state, mode);
    statusLight.dataset.tone = packet.lightTone;
    characterStage.dataset.aiIntensity = reaction.intensity;
    characterStage.dataset.aiMotion = reaction.motion;
    vibe = packet.vibe;
    updateVibe();

    if (state === "waiting") {
      startButton.textContent = "重播";
    }
  };

  const demoFlow = createDemoFlow({
    stepMs: options.demoStepMs,
    onState: setState,
  });
  const eventAdapter = createEventAdapter(setState);
  const sendEvent = (event) => {
    const mappedState = eventAdapter.sendEvent(event);
    if (event.type !== "ai:decision") {
      lastEvent.textContent = `Last event: ${describeEvent(event)}`;
    }

    return mappedState;
  };
  const eventUrl = options.eventUrl ?? "http://127.0.0.1:5174/events";
  const eventPoller = eventUrl
    ? createEventPoller({
        eventUrl,
        fetchImpl: options.fetchImpl,
        intervalMs: options.pollIntervalMs ?? 1000,
        onEvent: sendEvent,
      })
    : null;

  startButton.addEventListener("click", () => {
    startButton.textContent = "執行中";
    demoFlow.start();
  });

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      mode = button.dataset.modeOption;
      statusLine.textContent = getStatusCopy(agentState.current(), mode);
      syncModeButtons();
      savePreferences();
    });
  });

  scaleControl.addEventListener("input", () => {
    scale = Number(scaleControl.value);
    characterStage.dataset.scale = String(scale);
    savePreferences();
  });

  vibeControl.addEventListener("input", () => {
    vibe = Number(vibeControl.value);
    updateVibe();
  });

  debugButtons.forEach((button) => {
    button.addEventListener("click", () => setState(button.dataset.debugState));
  });

  characterStage.addEventListener("pointerdown", () => {
    isDragging = true;
  });

  window.addEventListener("pointermove", (event) => {
    if (!isDragging) {
      return;
    }

    anchor = { x: event.clientX, y: event.clientY };
    characterStage.dataset.anchorX = String(anchor.x);
    characterStage.dataset.anchorY = String(anchor.y);
  });

  window.addEventListener("pointerup", () => {
    if (!isDragging) {
      return;
    }

    isDragging = false;
    savePreferences();
  });

  resetPosition.addEventListener("click", () => {
    anchor = { x: 50, y: 46 };
    characterStage.dataset.anchorX = String(anchor.x);
    characterStage.dataset.anchorY = String(anchor.y);
    savePreferences();
  });

  eventButtons.forEach((button) => {
    button.addEventListener("click", () => {
      sendEvent(EVENT_PLAYGROUND[button.dataset.eventTrigger]);
    });
  });

  function syncModeButtons() {
    modeButtons.forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        button.dataset.modeOption === mode ? "true" : "false"
      );
    });
  }

  function updateVibe() {
    vibe = Math.max(0, Math.min(100, vibe));
    vibeMeter.style.setProperty("--vibe", `${vibe}%`);
    vibeControl.value = String(vibe);
    vibeOutput.textContent = String(vibe);
  }

  function drawLoop(time = 0) {
    drawBlob(characterCanvas, {
      ...getBlobFrame({
        state: agentState.current(),
        vibe,
        baseScale: scale,
        anchor,
        time,
        mode,
        reaction,
      }),
      mode,
      state: agentState.current(),
      time,
    });

    animationFrame = requestAnimationFrame(drawLoop);
  }

  syncModeButtons();
  updateVibe();

  if (typeof requestAnimationFrame === "function" && !isJsdomEnvironment()) {
    animationFrame = requestAnimationFrame(drawLoop);
  }

  if (eventPoller && !isJsdomEnvironment()) {
    eventPoller.start();
  }

  return {
    setState,
    sendEvent(event) {
      return sendEvent(event);
    },
    pollEventsOnce() {
      return eventPoller?.pollOnce();
    },
    destroy() {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      demoFlow.stop();
      eventPoller?.stop();
    },
  };
}

const EVENT_PLAYGROUND = {
  prompt: { type: "prompt:submitted" },
  read: { type: "tool:start", tool: "read" },
  edit: { type: "tool:start", tool: "edit" },
  test: { type: "tool:start", tool: "test" },
  "test-failed": { type: "tool:finish", tool: "test", status: "failed" },
  "test-passed": { type: "tool:finish", tool: "test", status: "passed" },
  complete: { type: "turn:complete" },
};

function describeEvent(event) {
  return [event.type, event.tool, event.status].filter(Boolean).join(" ");
}

function isJsdomEnvironment() {
  return globalThis.navigator?.userAgent?.toLowerCase().includes("jsdom");
}

export function drawBlob(canvas, frame) {
  let context;

  try {
    context = canvas?.getContext?.("2d");
  } catch {
    context = null;
  }

  if (!context) {
    return;
  }

  const width = canvas.width;
  const height = canvas.height;
  const pixel = 8;
  const centerX = width / 2;
  const centerY = height / 2;
  const amp = frame.motion?.amplitude ?? 1;
  const wobble = Math.sin(frame.time / 130) * amp;
  const jump = getPoseJump(frame.pose, frame.time, amp);
  const panic = frame.mood === "panic" ? Math.sin(frame.time / 34) * 5 * amp : 0;

  context.clearRect(0, 0, width, height);
  context.save();
  context.translate(centerX + panic, centerY - jump);
  context.scale(frame.scale, frame.scale);
  context.rotate(getPoseRotation(frame.pose, frame.time, amp));

  const palette = getCharacterPalette(frame);
  const body = palette.body;
  const shade = frame.mood === "panic" ? palette.panic : palette.shade;
  const face = palette.face;

  if (frame.characterId) {
    drawCharacterSprite(context, pixel, frame, palette);
    context.restore();
    return;
  }

  context.fillStyle = body;
  drawPixels(context, pixel, [
    [-4, -3], [-3, -4], [-2, -4], [-1, -4], [0, -4], [1, -4], [2, -3],
    [-5, -2], [-4, -2], [-3, -2], [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [3, -2],
    [-5, -1], [-4, -1], [-3, -1], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [3, -1], [4, -1],
    [-4, 0], [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
    [-4, 1], [-3, 1], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1],
    [-3, 2], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2],
  ]);

  context.fillStyle = shade;
  drawPixels(context, pixel, [[3, 1], [2, 2], [1, 2]]);

  context.fillStyle = face;
  const eyeY = frame.pose === "brace" || frame.pose === "test-watch" ? -1 : -2;
  if (frame.pose === "idle-blink") {
    drawPixels(context, pixel, [[-3, eyeY], [-2, eyeY], [1, eyeY], [2, eyeY]]);
  } else if (frame.pose === "idle-look") {
    drawPixels(context, pixel, [[-3, eyeY], [0, eyeY]]);
  } else {
    drawPixels(context, pixel, [[-2, eyeY], [1, eyeY]]);
  }

  if (frame.pose === "brace") {
    drawPixels(context, pixel, [[-1, 1], [0, 1]]);
    context.fillStyle = "#8df8ff";
    drawPixels(context, pixel, [[5, -3], [6, -2], [5, -1]]);
  } else if (frame.pose === "smug-dance") {
    drawPixels(context, pixel, [[-1, 0], [0, 0], [1, 0]]);
    context.fillStyle = "#ffd36f";
    drawPixels(context, pixel, [[-6, -5], [5, -5], [6, -4], [-5, -4]]);
  } else if (frame.pose === "spark-think") {
    drawPixels(context, pixel, [[-1, 0], [0, 0]]);
    context.fillStyle = "#ffd36f";
    drawPixels(context, pixel, [[4, -5], [5, -4], [4, -3]]);
  } else if (frame.pose === "inspect") {
    drawPixels(context, pixel, [[-1, 0], [0, 0]]);
    context.fillStyle = "#8df8ff";
    drawPixels(context, pixel, [[4, -2], [5, -2], [4, -1], [5, -1], [6, 0]]);
  } else if (frame.pose === "work-buddy") {
    drawPixels(context, pixel, [[-1, 0], [0, 0]]);
    context.fillStyle = "#c7a2ff";
    drawPixels(context, pixel, [[-5, 3], [-3, 3], [-1, 3], [1, 3], [3, 3]]);
    context.fillStyle = "#ffd36f";
    drawPixels(context, pixel, [[5, -2], [6, -2], [5, -1]]);
  } else if (frame.pose === "test-watch") {
    drawPixels(context, pixel, [[-1, 1], [0, 1]]);
    context.fillStyle = "#8df8ff";
    drawPixels(context, pixel, [[4, 2], [5, 2], [6, 2], [5, 3]]);
    context.fillStyle = "#ffd36f";
    drawPixels(context, pixel, [[-5, -3], [-5, -2]]);
  } else if (frame.pose === "quick-startle") {
    drawPixels(context, pixel, [[-1, 1], [0, 1]]);
    context.fillStyle = "#ff7d99";
    drawPixels(context, pixel, [[0, -7], [0, -6], [-5, -4], [5, -4]]);
    context.fillStyle = "#8df8ff";
    drawPixels(context, pixel, [[5, -2], [6, -1]]);
  } else if (frame.pose === "tiny-celebrate") {
    drawPixels(context, pixel, [[-1, 0], [0, 0], [1, 0]]);
    context.fillStyle = "#ffd36f";
    drawPixels(context, pixel, [[-6, -4], [5, -4], [6, -3]]);
    context.fillStyle = "#c7a2ff";
    drawPixels(context, pixel, [[-5, 2], [5, 2]]);
  } else if (frame.pose === "edge-peek") {
    drawPixels(context, pixel, [[-1, 0], [0, 0]]);
    context.fillStyle = "#c7a2ff";
    drawPixels(context, pixel, [[-6, -1], [5, -1], [6, 0]]);
  } else if (frame.pose === "panic-type") {
    drawPixels(context, pixel, [[-1, 1], [0, 1]]);
    context.fillStyle = "#c7a2ff";
    drawPixels(context, pixel, [[-5, 3], [-3, 3], [-1, 3], [1, 3], [3, 3], [5, 3]]);
  } else if (frame.pose === "sweat-pop") {
    drawPixels(context, pixel, [[-1, 1], [0, 1]]);
    context.fillStyle = "#8df8ff";
    drawPixels(context, pixel, [[5, -3], [6, -2], [5, -1]]);
    context.fillStyle = "#ff7d99";
    drawPixels(context, pixel, [[0, -7], [0, -6], [0, -5]]);
  } else if (frame.pose === "magnify") {
    drawPixels(context, pixel, [[-1, 0], [0, 0]]);
    context.fillStyle = "#ffd36f";
    drawPixels(context, pixel, [[4, -1], [5, -1], [4, 0], [5, 0], [6, 1], [7, 2]]);
  } else if (frame.pose === "point") {
    drawPixels(context, pixel, [[-1, 0], [0, 0]]);
    context.fillStyle = "#ffd36f";
    drawPixels(context, pixel, [[5, -2], [6, -2], [7, -2], [6, -3], [6, -1]]);
    context.fillStyle = "#c7a2ff";
    drawPixels(context, pixel, [[-6, 1], [-5, 2]]);
  } else if (frame.pose === "peek") {
    drawPixels(context, pixel, [[-1, 0], [0, 0]]);
    context.fillStyle = "#c7a2ff";
    drawPixels(context, pixel, [[-6, -1], [5, -1]]);
  } else if (frame.pose === "idle-blink") {
    drawPixels(context, pixel, [[-1, 0], [0, 0]]);
    context.fillStyle = "#ffd36f";
    drawPixels(context, pixel, [[3, -5]]);
  } else if (frame.pose === "idle-look") {
    drawPixels(context, pixel, [[-1, 0], [0, 0]]);
    context.fillStyle = "#8df8ff";
    drawPixels(context, pixel, [[-6, 0], [-5, 0], [5, -1]]);
  } else if (frame.pose === "idle-wave") {
    drawPixels(context, pixel, [[-1, 0], [0, 0]]);
    context.fillStyle = "#c7a2ff";
    drawPixels(context, pixel, [[5, -3], [6, -4], [6, -5], [-6, 1]]);
  } else {
    drawPixels(context, pixel, [[-1, 0], [0, 0]]);
  }

  context.restore();
}

function drawCharacterSprite(context, pixel, frame, palette) {
  const profile = getCharacterProfile(normalizeCharacterId(frame.characterId));

  if (profile.silhouette === "jellyfish") {
    drawJellyfishCharacter(context, pixel, frame, palette);
  } else if (profile.silhouette === "foam") {
    drawFoamGhostCharacter(context, pixel, frame, palette);
  } else {
    drawTerminalPixelCharacter(context, pixel, frame, palette);
  }

  drawCharacterPoseAccent(context, pixel, frame, palette, profile.silhouette);
}

function drawJellyfishCharacter(context, pixel, frame, palette) {
  const shade = frame.mood === "panic" ? palette.panic : palette.shade;

  context.fillStyle = palette.body;
  drawPixels(context, pixel, [
    [-2, -5], [-1, -5], [0, -5], [1, -5],
    [-4, -4], [-3, -4], [-2, -4], [-1, -4], [0, -4], [1, -4], [2, -4], [3, -4],
    [-5, -3], [-4, -3], [-3, -3], [-2, -3], [-1, -3], [0, -3], [1, -3], [2, -3], [3, -3], [4, -3],
    [-5, -2], [-4, -2], [-3, -2], [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [3, -2], [4, -2], [5, -2],
    [-4, -1], [-3, -1], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [3, -1], [4, -1],
    [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0],
  ]);

  context.fillStyle = shade;
  drawPixels(context, pixel, [
    [-3, 1], [-1, 1], [1, 1], [3, 1],
    [-3, 2], [-1, 2], [1, 2], [3, 2],
    [-4, 3], [-2, 3], [0, 3], [2, 3], [4, 3],
    [-4, 4], [0, 4], [4, 4],
  ]);

  context.fillStyle = palette.face;
  drawCharacterEyes(context, pixel, frame, {
    defaultEyes: [[-2, -2], [1, -2]],
    blinkEyes: [[-3, -2], [-2, -2], [1, -2], [2, -2]],
    lookEyes: [[-3, -2], [0, -2]],
    mouth: [[-1, -1], [0, -1]],
  });
}

function drawFoamGhostCharacter(context, pixel, frame, palette) {
  const shade = frame.mood === "panic" ? palette.panic : palette.shade;

  context.fillStyle = palette.body;
  drawPixels(context, pixel, [
    [-2, -5], [-1, -5], [0, -5], [1, -5],
    [-3, -4], [-2, -4], [-1, -4], [0, -4], [1, -4], [2, -4],
    [-4, -3], [-3, -3], [-2, -3], [-1, -3], [0, -3], [1, -3], [2, -3], [3, -3],
    [-4, -2], [-3, -2], [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [3, -2],
    [-5, -1], [-4, -1], [-3, -1], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [3, -1], [4, -1],
    [-5, 0], [-4, 0], [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
    [-4, 1], [-3, 1], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1],
    [-4, 2], [-3, 2], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2], [3, 2],
    [-4, 3], [-2, 3], [-1, 3], [1, 3], [2, 3], [4, 3],
  ]);

  context.fillStyle = shade;
  drawPixels(context, pixel, [
    [-5, 1], [-5, 2], [4, 1], [4, 2],
    [-3, 4], [0, 4], [3, 4],
  ]);

  context.fillStyle = palette.face;
  drawCharacterEyes(context, pixel, frame, {
    defaultEyes: [[-2, -2], [1, -2]],
    blinkEyes: [[-3, -2], [-2, -2], [1, -2], [2, -2]],
    lookEyes: [[-3, -2], [0, -2]],
    mouth: [[-1, 0], [0, 0]],
  });
}

function drawTerminalPixelCharacter(context, pixel, frame, palette) {
  const shade = frame.mood === "panic" ? palette.panic : palette.shade;

  context.fillStyle = palette.body;
  drawPixels(context, pixel, [
    [-3, -6], [3, -6],
    [-4, -5], [-3, -5], [-2, -5], [-1, -5], [0, -5], [1, -5], [2, -5], [3, -5], [4, -5],
    [-5, -4], [-4, -4], [-3, -4], [-2, -4], [-1, -4], [0, -4], [1, -4], [2, -4], [3, -4], [4, -4], [5, -4],
    [-5, -3], [-4, -3], [-3, -3], [-2, -3], [-1, -3], [0, -3], [1, -3], [2, -3], [3, -3], [4, -3], [5, -3],
    [-5, -2], [-4, -2], [-3, -2], [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [3, -2], [4, -2], [5, -2],
    [-5, -1], [-4, -1], [-3, -1], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [3, -1], [4, -1], [5, -1],
    [-5, 0], [-4, 0], [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0],
    [-4, 1], [-3, 1], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1],
    [-3, 2], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2], [3, 2],
    [-4, 4], [-3, 4], [3, 4], [4, 4],
  ]);

  context.fillStyle = palette.face;
  drawPixels(context, pixel, [
    [-3, -3], [-2, -3], [-1, -3], [0, -3], [1, -3], [2, -3], [3, -3],
    [-3, -2], [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [3, -2],
    [-3, -1], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [3, -1],
    [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0],
  ]);

  context.fillStyle = shade;
  if (frame.pose === "idle-blink") {
    drawPixels(context, pixel, [[-2, -2], [-1, -2], [1, -2], [2, -2]]);
  } else if (frame.pose === "idle-look") {
    drawPixels(context, pixel, [[-2, -2], [0, -2]]);
  } else {
    drawPixels(context, pixel, [[-2, -2], [2, -2]]);
  }
  drawPixels(context, pixel, [[-1, 0], [0, 0], [1, 0]]);
}

function drawCharacterEyes(context, pixel, frame, eyeMap) {
  if (frame.pose === "idle-blink") {
    drawPixels(context, pixel, eyeMap.blinkEyes);
  } else if (frame.pose === "idle-look") {
    drawPixels(context, pixel, eyeMap.lookEyes);
  } else {
    drawPixels(context, pixel, eyeMap.defaultEyes);
  }

  drawPixels(context, pixel, eyeMap.mouth);
}

function drawCharacterPoseAccent(context, pixel, frame, palette, silhouette) {
  if (frame.pose === "spark-think") {
    context.fillStyle = "#ffd36f";
    drawPixels(context, pixel, [[4, -6], [5, -5], [4, -4]]);
  } else if (frame.pose === "inspect" || frame.pose === "magnify") {
    context.fillStyle = "#8df8ff";
    drawPixels(context, pixel, [[4, -1], [5, -1], [4, 0], [5, 0], [6, 1]]);
  } else if (frame.pose === "work-buddy" || frame.pose === "panic-type") {
    context.fillStyle = silhouette === "pixel" ? "#ffd36f" : palette.shade;
    drawPixels(context, pixel, [[-5, 4], [-3, 4], [-1, 4], [1, 4], [3, 4], [5, 4]]);
  } else if (frame.pose === "test-watch") {
    context.fillStyle = "#8df8ff";
    drawPixels(context, pixel, [[4, 2], [5, 2], [6, 2], [5, 3]]);
  } else if (frame.pose === "quick-startle" || frame.pose === "sweat-pop") {
    context.fillStyle = "#ff7d99";
    drawPixels(context, pixel, [[0, -8], [0, -7], [-5, -5], [5, -5]]);
  } else if (frame.pose === "tiny-celebrate" || frame.pose === "smug-dance") {
    context.fillStyle = "#ffd36f";
    drawPixels(context, pixel, [[-6, -5], [5, -5], [6, -4], [-5, -4]]);
  } else if (frame.pose === "point") {
    context.fillStyle = "#ffd36f";
    drawPixels(context, pixel, [[5, -2], [6, -2], [7, -2], [6, -3], [6, -1]]);
  } else if (frame.pose === "idle-wave") {
    context.fillStyle = palette.shade;
    drawPixels(context, pixel, [[5, -3], [6, -4], [6, -5], [-6, 1]]);
  } else if (frame.pose === "edge-peek" || frame.pose === "peek") {
    context.fillStyle = palette.shade;
    drawPixels(context, pixel, [[-6, -1], [5, -1], [6, 0]]);
  }
}

function getCharacterPalette(frame = {}) {
  if (!frame.characterId) {
    return {
      body: frame.mode === "showcase" ? "#8df8ff" : "#89ffc1",
      shade: frame.mood === "panic" ? "#ff7d99" : "#4be39d",
      panic: "#ff7d99",
      face: "#071014",
    };
  }

  const profile = getCharacterProfile(normalizeCharacterId(frame.characterId));
  return {
    body: profile.theme.accent,
    shade: profile.theme.glow,
    panic: "#ff7d99",
    face: "#071014",
  };
}

function getPoseJump(pose, time, amplitude) {
  const jumps = {
    float: Math.sin(time / 260) * 4,
    "spark-think": Math.sin(time / 180) * 5,
    inspect: Math.sin(time / 220) * 3,
    "panic-type": Math.abs(Math.sin(time / 70)) * 7,
    brace: Math.sin(time / 100) * 2,
    "sweat-pop": Math.abs(Math.sin(time / 55)) * 5,
    "work-buddy": Math.sin(time / 180) * 2,
    "test-watch": Math.sin(time / 220) * 1.5,
    "quick-startle": Math.abs(Math.sin(time / 70)) * 3,
    "tiny-celebrate": Math.sin(time / 120) * 4,
    "edge-peek": Math.sin(time / 420) * 0.8,
    magnify: Math.sin(time / 150) * 4,
    point: Math.sin(time / 180) * 2,
    "smug-dance": Math.sin(time / 80) * 12,
    peek: Math.sin(time / 300) * 2,
    "idle-blink": Math.sin(time / 360) * 1,
    "idle-look": Math.sin(time / 260) * 3,
    "idle-wave": Math.sin(time / 180) * 5,
  };

  return (jumps[pose] ?? 0) * amplitude;
}

function getPoseRotation(pose, time, amplitude) {
  const active = [
    "panic-type",
    "sweat-pop",
    "quick-startle",
    "tiny-celebrate",
    "smug-dance",
    "magnify",
    "point",
    "idle-wave",
  ];

  if (!active.includes(pose)) {
    return 0;
  }

  return Math.sin(time / 90) * 0.08 * amplitude;
}

function drawPixels(context, size, points) {
  for (const [x, y] of points) {
    context.fillRect(x * size, y * size, size, size);
  }
}
