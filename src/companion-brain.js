const DEFAULT_TTL_MS = 3600;
const HIGH_PRIORITY_TTL_MS = 4200;
const DEFAULT_COOLDOWN_MS = 8000;

const SKILL_SPEECH = {
  diagnose: "用 diagnose。先重現錯誤，再縮小範圍。",
  "frontend-design": "用 frontend-design。先穩住版面，再調細節。",
  "write-a-prd": "用 write-a-prd。先把需求切成可驗證條目。",
  prototype: "用 prototype。先做一個能玩的版本。",
  "openai-docs": "用 openai-docs。先查官方說法再改。",
  tdd: "用 TDD。先寫一個會失敗的小測試。",
};

export function createCompanionBrain({ getNow = () => Date.now() } = {}) {
  let lastSpeech = "";
  let lastSpeechAt = -Infinity;

  return {
    react(event = {}, workContext = null) {
      const now = getNow();
      const reaction = createBrainReaction({ event, workContext });
      if (
        !reaction.quiet &&
        reaction.speech === lastSpeech &&
        now - lastSpeechAt < DEFAULT_COOLDOWN_MS
      ) {
        return createQuietReaction(reaction.state);
      }

      if (!reaction.quiet) {
        lastSpeech = reaction.speech;
        lastSpeechAt = now;
      }

      return reaction;
    },
  };
}

function createBrainReaction({ event, workContext }) {
  const state = String(event.state ?? "waiting");

  if (event.type !== "ai:decision") {
    const contextReaction = createContextReaction({ event, state, workContext });
    if (contextReaction) {
      return contextReaction;
    }

    return createQuietReaction(state);
  }

  const adviceSpeech = createAdviceSpeech(event.nextStepAdvice);
  if (event.nextStepAdvice && !adviceSpeech) {
    return createQuietReaction(state);
  }

  const contextReaction = createContextReaction({ event, state, workContext });
  if (!adviceSpeech && contextReaction) {
    return contextReaction;
  }

  const skill = normalizeSkill(event.skillHint?.skill);
  const speech = adviceSpeech || (skill ? SKILL_SPEECH[skill] : normalizeSpeech(event.line));
  if (!speech || state === "idle" || state === "waiting") {
    return createQuietReaction(state);
  }

  const priority = getPriority(event);
  return {
    state,
    speech,
    gesture: adviceSpeech || skill ? "point" : getGestureForState(state),
    priority,
    ttlMs: priority === "high" ? HIGH_PRIORITY_TTL_MS : DEFAULT_TTL_MS,
    quiet: false,
  };
}

function createContextReaction({ state, workContext }) {
  if (
    workContext?.activity === "repeated-test-failure" &&
    workContext.friction === "high"
  ) {
    return {
      state,
      speech: "連續測試失敗。用 diagnose 先縮小範圍。",
      gesture: "point",
      priority: "high",
      ttlMs: HIGH_PRIORITY_TTL_MS,
      quiet: false,
    };
  }

  if (workContext?.phase === "coding" && workContext.friction === "low") {
    return createQuietReaction(state);
  }

  return null;
}

function createQuietReaction(state) {
  return {
    state,
    speech: "",
    gesture: "idle",
    priority: "low",
    ttlMs: 0,
    quiet: true,
  };
}

function normalizeSkill(skill) {
  const value = String(skill ?? "").trim();
  return SKILL_SPEECH[value] ? value : "";
}

function createAdviceSpeech(advice) {
  if (!advice) return "";
  if (advice.speakable === false) return "";
  const priority = String(advice.priority ?? "low");
  if (!["high", "medium"].includes(priority)) return "";
  if (advice.presentation?.bubble) {
    return normalizeSpeech(advice.presentation.bubble);
  }

  const skill = String(advice.skill ?? "").trim();
  const action = shortenAdviceAction(advice.action ?? advice.title);
  if (!action) return "";

  return skill ? normalizeSpeech(`用 ${skill}：${stripLeadingSkill(action, skill)}`) : normalizeSpeech(action);
}

function shortenAdviceAction(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  const firstClause = text.split(/[，,。]/)[0]?.trim() ?? "";
  return firstClause ? `${firstClause}。` : "";
}

function stripLeadingSkill(value, skill) {
  return String(value)
    .replace(new RegExp(`^用\\s+${escapeRegExp(skill)}\\s*[:：]?\\s*`, "i"), "")
    .replace(new RegExp(`^使用\\s+${escapeRegExp(skill)}\\s*[:：]?\\s*`, "i"), "")
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSpeech(value) {
  const speech = String(value ?? "").replace(/\s+/g, " ").trim();
  return speech.length > 54 ? `${speech.slice(0, 53)}…` : speech;
}

function getPriority(event) {
  if (event.nextStepAdvice?.priority === "high") return "high";
  if (event.intensity === "high") return "high";
  if (event.state === "error" || event.state === "debugging") return "high";
  return "medium";
}

function getGestureForState(state) {
  const gestures = {
    error: "startle",
    debugging: "inspect",
    success: "celebrate",
    coding: "nod",
    testing: "watch",
  };

  return gestures[state] ?? "observe";
}
