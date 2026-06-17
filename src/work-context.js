const EMPTY_CONTEXT = {
  activity: "quiet",
  phase: "waiting",
  friction: "low",
  suggestedSkill: "",
  recentFailureCount: 0,
  recentEditCount: 0,
  lastMeaningfulEventAt: 0,
};

export function createWorkContextTracker({ getNow = () => Date.now() } = {}) {
  const recentEvents = [];
  let context = { ...EMPTY_CONTEXT };

  return {
    observe(event = {}) {
      const now = getNow();
      recentEvents.push({ event, at: now });
      while (recentEvents.length > 12) {
        recentEvents.shift();
      }
      context = deriveWorkContext(recentEvents, now);
      return context;
    },
    current() {
      return { ...context };
    },
  };
}

function deriveWorkContext(recentEvents, now) {
  const recentFailureCount = recentEvents.filter(({ event }) =>
    isFailedTestEvent(event)
  ).length;
  const recentEditCount = recentEvents.filter(({ event }) =>
    isEditEvent(event)
  ).length;
  const lastMeaningfulEventAt = recentEvents.at(-1)?.at ?? 0;

  if (recentFailureCount >= 2) {
    return {
      activity: "repeated-test-failure",
      phase: "debugging",
      friction: "high",
      suggestedSkill: "diagnose",
      recentFailureCount,
      recentEditCount,
      lastMeaningfulEventAt,
    };
  }

  const latestAiDecision = [...recentEvents]
    .reverse()
    .find(({ event }) => event.type === "ai:decision")?.event;

  if (latestAiDecision) {
    return {
      activity: "ai-decision",
      phase: normalizePhase(latestAiDecision.state),
      friction: latestAiDecision.state === "error" ? "high" : "low",
      suggestedSkill: String(latestAiDecision.skillHint?.skill ?? ""),
      recentFailureCount,
      recentEditCount,
      lastMeaningfulEventAt,
    };
  }

  if (recentFailureCount === 1) {
    return {
      activity: "test-failure",
      phase: "debugging",
      friction: "medium",
      suggestedSkill: "diagnose",
      recentFailureCount,
      recentEditCount,
      lastMeaningfulEventAt,
    };
  }

  if (recentEditCount > 0) {
    return {
      activity: "editing",
      phase: "coding",
      friction: "low",
      suggestedSkill: "",
      recentFailureCount,
      recentEditCount,
      lastMeaningfulEventAt,
    };
  }

  return {
    ...EMPTY_CONTEXT,
    lastMeaningfulEventAt,
  };
}

function isFailedTestEvent(event = {}) {
  return (
    event.type === "tool:finish" &&
    event.tool === "test" &&
    event.status === "failed"
  );
}

function isEditEvent(event = {}) {
  return event.type === "tool:start" && ["edit", "write"].includes(event.tool);
}

function normalizePhase(state) {
  const value = String(state ?? "");
  if (!value) return "waiting";
  return value;
}
