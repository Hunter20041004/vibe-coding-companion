const SKILL_RULES = [
  {
    skill: "frontend-design",
    confidence: "high",
    reason: "適合處理 UI、互動、視覺與版面調整。",
    keywords: [
      "ui",
      "ux",
      "css",
      "layout",
      "visual",
      "interface",
      "component",
      "canvas",
      "overlay",
      "responsive",
      "animation",
      "畫面",
      "介面",
      "視覺",
      "版面",
      "互動",
      "動畫",
    ],
  },
  {
    skill: "diagnose",
    confidence: "high",
    reason: "適合重現、定位並修復 bug 或測試失敗。",
    keywords: [
      "bug",
      "broken",
      "crash",
      "error",
      "failed",
      "failure",
      "failing",
      "regression",
      "debug",
      "錯誤",
      "壞掉",
      "失敗",
      "除錯",
      "修 bug",
    ],
  },
  {
    skill: "write-a-prd",
    confidence: "high",
    reason: "適合把需求整理成可執行的產品規格。",
    keywords: ["prd", "requirements", "spec", "plan", "需求", "規格", "計畫"],
  },
  {
    skill: "prototype",
    confidence: "medium",
    reason: "適合先做可玩的原型來驗證方向。",
    keywords: ["prototype", "mvp", "spike", "mock", "試做", "原型", "雛形"],
  },
  {
    skill: "openai-docs",
    confidence: "medium",
    reason: "適合查 OpenAI、Codex、模型或 API 的官方資訊。",
    keywords: ["openai", "codex", "api", "model", "模型", "官方文件"],
  },
  {
    skill: "tdd",
    confidence: "medium",
    reason: "適合用 Red-Green-Refactor 推進功能或修正。",
    keywords: ["test", "tests", "testing", "coverage", "e2e", "implement", "feature", "測試", "實作", "功能"],
  },
];

const FALLBACK_HINT = {
  skill: "tdd",
  confidence: "low",
  reason: "不確定時先用 TDD 拆一個小的可驗證切片。",
};

export function recommendSkillForTask(context = {}) {
  const haystack = buildSearchText(context);
  const ranked = SKILL_RULES.map((rule) => ({
    rule,
    score: scoreRule(rule, haystack),
  }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  const winner = ranked[0]?.rule;
  if (!winner) return { ...FALLBACK_HINT };

  return {
    skill: winner.skill,
    confidence: winner.confidence,
    reason: winner.reason,
  };
}

function buildSearchText(context = {}) {
  const event = context.event ?? {};
  return [
    context.activity,
    context.line,
    context.suggestedState,
    context.state,
    event.type,
    event.tool,
    event.status,
    ...(Array.isArray(context.visibleSignals) ? context.visibleSignals : []),
    ...(Array.isArray(context.recentEvents)
      ? context.recentEvents.flatMap((recentEvent) => [
          recentEvent.type,
          recentEvent.tool,
          recentEvent.status,
        ])
      : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function scoreRule(rule, haystack) {
  return rule.keywords.reduce((score, keyword) => {
    return haystack.includes(keyword.toLowerCase()) ? score + 1 : score;
  }, 0);
}
