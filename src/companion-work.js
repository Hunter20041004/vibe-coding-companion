import { createCompanionBrain } from "./companion-brain.js";
import { mapEventToState } from "./event-adapter.js";
import { createWorkContextTracker } from "./work-context.js";

export const COMPANION_LIGHT_TONES = {
  idle: "idle",
  thinking: "running",
  reading: "running",
  coding: "running",
  testing: "running",
  error: "blocked",
  debugging: "running",
  success: "done",
  waiting: "waiting",
};

const DEFAULT_REACTION = {
  intensity: "medium",
  motion: "wander",
  line: "",
};

export function createCompanionWorkInterpreter({
  initialState = "idle",
  initialVibe = 62,
  initialReaction = DEFAULT_REACTION,
  brain = createCompanionBrain(),
  workContextTracker = createWorkContextTracker(),
} = {}) {
  let state = initialState;
  let vibe = initialVibe;
  let reaction = { ...DEFAULT_REACTION, ...initialReaction };
  let lastPacket = createPacket({
    state,
    event: {},
    vibe,
    reaction,
    workContext: workContextTracker.current(),
    brainReaction: createQuietBrainReaction(state),
  });

  return {
    current() {
      return lastPacket;
    },
    observeEvent(event = {}) {
      const nextState = mapEventToState(event);
      if (!nextState) return null;
      return this.observeState(nextState, event);
    },
    observeState(nextState, event = {}) {
      state = nextState;
      reaction = getReactionFromEvent(event, reaction);
      vibe = applyVibeChange(vibe, state);
      const workContext = workContextTracker.observe({ ...event, state });
      const brainReaction = brain.react({ ...event, state }, workContext);
      reaction = {
        ...reaction,
        gesture: brainReaction.gesture,
      };
      lastPacket = createPacket({
        state,
        event,
        vibe,
        reaction,
        workContext,
        brainReaction,
      });
      return lastPacket;
    },
  };
}

export function applyVibeChange(currentVibe, state) {
  const changes = {
    thinking: 1,
    reading: 2,
    coding: 4,
    testing: -3,
    error: -20,
    debugging: 8,
    success: 24,
    waiting: 0,
    idle: 0,
  };

  return Math.max(0, Math.min(100, currentVibe + (changes[state] ?? 0)));
}

export function getReactionFromEvent(event = {}, currentReaction = DEFAULT_REACTION) {
  if (event.type !== "ai:decision") {
    return {
      ...currentReaction,
      line: "",
    };
  }

  return {
    intensity: event.intensity ?? currentReaction.intensity,
    motion: event.motion ?? currentReaction.motion,
    line: event.line ?? "",
  };
}

function createPacket({
  state,
  event,
  vibe,
  reaction,
  workContext,
  brainReaction,
}) {
  return {
    state,
    event,
    vibe,
    reaction,
    lightTone: COMPANION_LIGHT_TONES[state],
    workContext,
    brainReaction,
  };
}

function createQuietBrainReaction(state) {
  return {
    state,
    speech: "",
    gesture: "idle",
    priority: "low",
    ttlMs: 0,
    quiet: true,
  };
}
