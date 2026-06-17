import { createCompanionWorkInterpreter } from "./companion-work.js";
import { createEventPoller } from "./event-poller.js";

const DEFAULT_PLACEMENT = "right-edge";
const SAFE_ZONES = [DEFAULT_PLACEMENT, "top-right", "bottom-right", "retreat"];

export function createOverlayStateTracker({
  eventUrl = "http://127.0.0.1:5174/events",
  fetchImpl = globalThis.fetch,
  intervalMs = 600,
  getNow = () => Date.now(),
  transientMs = 1600,
} = {}) {
  let currentState = "idle";
  let currentPlacement = DEFAULT_PLACEMENT;
  let transientUntil = 0;
  const workInterpreter = createCompanionWorkInterpreter({
    initialState: currentState,
  });
  const eventPoller = eventUrl
    ? createEventPoller({
        eventUrl,
        fetchImpl,
        intervalMs,
        onEvent: (event) => updateFromEvent(event),
      })
    : null;

  function updateFromEvent(event = {}) {
    const packet = workInterpreter.observeEvent(event);
    if (!packet) return null;
    currentState = packet.state;
    currentPlacement =
      event.type === "ai:decision"
        ? normalizePlacement(event.safeZone) || currentPlacement
        : DEFAULT_PLACEMENT;
    transientUntil = isTransientState(currentState) ? getNow() + transientMs : 0;
    return currentState;
  }

  return {
    current() {
      if (transientUntil && getNow() >= transientUntil) {
        currentState = "waiting";
        transientUntil = 0;
      }
      return currentState;
    },
    placement() {
      return currentPlacement;
    },
    sendEvent(event) {
      return updateFromEvent(event);
    },
    pollOnce() {
      return eventPoller?.pollOnce();
    },
    start() {
      eventPoller?.start();
    },
    stop() {
      eventPoller?.stop();
    },
  };
}

function isTransientState(state) {
  return state === "error" || state === "success";
}

function normalizePlacement(safeZone) {
  const value = String(safeZone ?? "").trim();
  return SAFE_ZONES.includes(value) ? value : "";
}
