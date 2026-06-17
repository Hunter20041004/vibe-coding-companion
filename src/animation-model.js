export function getAnimationMood(vibe) {
  if (vibe < 35) {
    return "panic";
  }

  if (vibe > 75) {
    return "playful";
  }

  return "steady";
}

export function getBlobFrame({
  state,
  vibe,
  baseScale = 1,
  anchor = { x: 50, y: 50 },
  time = 0,
  mode = "calm",
  reaction = {},
}) {
  const mood = getAnimationMood(vibe);
  const stateMultiplier = state === "success" && mood === "playful" ? 1.2 : 1;
  const multiplier = stateMultiplier * getReactionScale(reaction);
  const motion = getMotion({ mode, reaction, state });
  const position = getPosition({ state, anchor, time, motion });
  const pose = getPose({ state, mood, reaction, time });

  if (state === "testing" && mood === "panic") {
    return {
      mood,
      pose: "brace",
      scale: baseScale * multiplier,
      position,
      motion,
    };
  }

  if (state === "success" && mood === "playful") {
    return {
      mood,
      pose: "smug-dance",
      scale: baseScale * multiplier,
      position,
      motion,
    };
  }

  return { mood, pose, scale: baseScale * multiplier, position, motion };
}

function getPosition({ state, anchor, time, motion }) {
  const range = getStateRange(state) * motion.amplitude;
  const wave = Math.sin(time / 120);

  return {
    x: anchor.x + wave * range,
    y: anchor.y + Math.cos(time / 160) * range * 0.6,
  };
}

function getStateRange(state) {
  if (state === "idle" || state === "waiting") return 3;
  if (state === "coding") return 8;
  return 6;
}

function getMotion({ mode, reaction = {}, state }) {
  const amplitudes = {
    calm: 0.55,
    snark: 1,
    showcase: 1.45,
  };

  return {
    amplitude:
      (amplitudes[mode] ?? amplitudes.calm) *
      getStateMotionMultiplier(state) *
      getIntensityMotionMultiplier(reaction.intensity) *
      getMotionFamilyMultiplier(reaction.motion),
  };
}

function getStateMotionMultiplier(state) {
  if (state === "idle" || state === "waiting") return 0.55;
  return 1;
}

function getPose({ state, reaction = {}, time = 0 }) {
  const gesturePose = getGesturePose(reaction.gesture);
  if (gesturePose) {
    return gesturePose;
  }

  const reactionPoses = {
    panic: "quick-startle",
    celebrate: "tiny-celebrate",
    observe: "inspect",
  };

  if (reactionPoses[reaction.motion]) {
    return reactionPoses[reaction.motion];
  }

  if (state === "idle" || state === "waiting") {
    return getIdlePose({ state, time });
  }

  const poses = {
    thinking: "spark-think",
    reading: "inspect",
    coding: "work-buddy",
    testing: "test-watch",
    error: "quick-startle",
    debugging: "magnify",
    success: "tiny-celebrate",
  };

  return poses[state] ?? "float";
}

function getGesturePose(gesture) {
  const poses = {
    point: "point",
    nod: "work-buddy",
    watch: "test-watch",
    inspect: "magnify",
    startle: "quick-startle",
    celebrate: "tiny-celebrate",
  };

  return poses[gesture] ?? "";
}

function getIdlePose({ state, time = 0 }) {
  const cycles = {
    idle: ["float", "idle-blink", "idle-look", "idle-wave"],
    waiting: ["edge-peek", "edge-peek", "idle-blink", "edge-peek"],
  };
  const cycle = cycles[state] ?? cycles.idle;
  const index = Math.floor(Math.max(0, time) / 2800) % cycle.length;
  return cycle[index];
}

function getIntensityMotionMultiplier(intensity) {
  const multipliers = {
    low: 0.7,
    medium: 1,
    high: 1.35,
  };

  return multipliers[intensity] ?? multipliers.medium;
}

function getMotionFamilyMultiplier(motion) {
  const multipliers = {
    observe: 0.62,
    wander: 0.42,
    work: 1.1,
    panic: 0.9,
    celebrate: 0.85,
  };

  return multipliers[motion] ?? 1;
}

function getReactionScale(reaction = {}) {
  const multipliers = {
    low: 0.96,
    medium: 1,
    high: 1.08,
  };

  return multipliers[reaction.intensity] ?? multipliers.medium;
}
