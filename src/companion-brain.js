const DEFAULT_TTL_MS = 3600;
const HIGH_PRIORITY_TTL_MS = 4200;
const DEFAULT_COOLDOWN_MS = 8000;

const SKILL_SPEECH = {
  diagnose: "先縮小錯誤範圍。可用 diagnose。",
  "frontend-design": "先檢查畫面狀態。可用 frontend-design。",
  "write-a-prd": "先整理需求範圍。可用 write-a-prd。",
  prototype: "先做可玩原型。可用 prototype。",
  "openai-docs": "先查官方文件。可用 openai-docs。",
  tdd: "先切一個小測試。可用 tdd。",
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

  const contextReaction = createContextReaction({ event, state, workContext });
  const hintSpeech = createSkillHintSpeech(event.skillHint);
  const adviceSkillSpeech = createAdviceSkillSpeech(event.nextStepAdvice);
  const speech = hintSpeech || adviceSkillSpeech;
  if (!speech && contextReaction) {
    return contextReaction;
  }

  if (!speech || state === "idle" || state === "waiting") {
    return createQuietReaction(state);
  }

  const priority = getPriority(event);
  return {
    state,
    speech,
    gesture: "point",
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
      speech: SKILL_SPEECH.diagnose,
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

function createSkillHintSpeech(skillHint) {
  if (!skillHint || skillHint.confidence !== "high") return "";
  return skillHint.bubble
    ? normalizeSpeech(skillHint.bubble)
    : createSkillSpeech(skillHint.skill);
}

function createAdviceSkillSpeech(advice) {
  if (!advice) return "";
  if (advice.speakable === false) return "";
  const priority = String(advice.priority ?? "low");
  if (!["high", "medium"].includes(priority)) return "";

  const skill = String(advice.skill ?? "").trim();
  return skill ? createSkillSpeech(skill) : "";
}

function createSkillSpeech(skill) {
  const value = String(skill ?? "").trim();
  if (!value) return "";
  return SKILL_SPEECH[value] ?? `先切到合適流程。可用 ${truncateSkillName(value)}。`;
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

function truncateSkillName(skill) {
  return skill.length > 28 ? `${skill.slice(0, 27)}…` : skill;
}
