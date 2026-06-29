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
      "failed test",
      "failure",
      "failing",
      "failing test",
      "regression",
      "test failed",
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
    skill: "humanizer-zh",
    confidence: "high",
    reason: "適合把中文文案改得更自然、降低 AI 味。",
    keywords: [
      "humanize",
      "rewrite chinese",
      "copywriting",
      "ai 味",
      "ai味",
      "去 ai",
      "去ai",
      "中文文案",
      "改寫",
      "潤稿",
      "自然",
    ],
  },
  {
    skill: "write-a-skill",
    confidence: "high",
    reason: "適合建立或修改 Codex skill。",
    keywords: ["skill.md", "agent skill", "codex skill", "寫 skill", "建立 skill", "新增 skill"],
  },
  {
    skill: "to-issues",
    confidence: "medium",
    reason: "適合把計畫拆成可獨立執行的 issues。",
    keywords: ["issues", "tickets", "break down", "切票", "拆 issue", "任務拆解"],
  },
  {
    skill: "triage",
    confidence: "medium",
    reason: "適合整理、分類或補齊 issue 資訊。",
    keywords: ["triage", "bug report", "issue queue", "分流", "分類 issue", "整理 issue"],
  },
  {
    skill: "openspec",
    confidence: "medium",
    reason: "適合用 OpenSpec 規格流程推進變更。",
    keywords: ["openspec", "proposal", "delta spec", "change workflow"],
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
  {
    skill: "zoom-out",
    confidence: "low",
    reason: "適合先理解架構脈絡或要求更高層次說明。",
    keywords: ["zoom out", "big picture", "architecture context", "大局", "整體架構", "高層次"],
  },
];

const FALLBACK_HINT = {
  skill: "tdd",
  confidence: "low",
  reason: "不確定時先用 TDD 拆一個小的可驗證切片。",
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "when",
  "user",
  "use",
  "using",
  "into",
  "from",
  "have",
  "has",
  "are",
  "you",
  "your",
  "skill",
  "skills",
]);

export function recommendSkillForTask(context = {}, options = {}) {
  const haystack = buildSearchText(context);
  const allowFallback = options.allowFallback ?? context.allowFallback ?? true;
  const installedWinner = rankInstalledSkills(
    options.skills ?? context.skills ?? [],
    haystack
  )[0];
  if (installedWinner) {
    return {
      skill: installedWinner.skill.name,
      confidence: confidenceForInstalledScore(installedWinner.score),
      reason:
        installedWinner.skill.description ||
        `Installed skill: ${installedWinner.skill.name}`,
    };
  }

  const ranked = SKILL_RULES.map((rule) => ({
    rule,
    score: scoreRule(rule, haystack),
  }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  const winner = ranked[0]?.rule;
  if (!winner) return allowFallback ? { ...FALLBACK_HINT } : null;

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
    context.prompt,
    context.suggestedState,
    context.state,
    event.type,
    event.prompt,
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
  const keywordScore = rule.keywords.reduce((score, keyword) => {
    return haystack.includes(keyword.toLowerCase()) ? score + 1 : score;
  }, 0);
  if (rule.skill === "diagnose" && hasFailingTestSignal(haystack)) {
    return keywordScore + 2;
  }

  return keywordScore;
}

function hasFailingTestSignal(haystack) {
  return /\b(fail|failed|failing|failure)\b/.test(haystack) &&
    /\btests?\b/.test(haystack);
}

function rankInstalledSkills(skills, haystack) {
  if (!Array.isArray(skills) || !skills.length) return [];

  const haystackTokens = tokenize(haystack);
  return skills
    .map((skill) => ({
      skill,
      score: scoreInstalledSkill(skill, haystack, haystackTokens),
    }))
    .filter((item) => item.skill?.name && item.score > 0)
    .sort((left, right) => right.score - left.score);
}

function scoreInstalledSkill(skill, haystack, haystackTokens) {
  const name = String(skill.name ?? "").toLowerCase();
  const description = String(skill.description ?? "");
  const skillTokens = new Set(tokenize(`${name} ${description}`));
  const curatedRule = SKILL_RULES.find((rule) => rule.skill === name);
  let score = 0;

  if (curatedRule) {
    score += scoreRule(curatedRule, haystack) * 3;
  }

  if (name && haystack.includes(name)) {
    score += 5;
  }

  for (const token of tokenize(name)) {
    if (haystackTokens.includes(token)) {
      score += 2;
    }
  }

  for (const token of haystackTokens) {
    if (skillTokens.has(token)) {
      score += 1;
    }
  }

  return score;
}

function tokenize(value) {
  return String(value)
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9-]{2,}/g)
    ?.map(normalizeToken)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token)) ?? [];
}

function normalizeToken(token) {
  return token.replace(/s$/, "");
}

function confidenceForInstalledScore(score) {
  if (score >= 2) return "high";
  return "medium";
}
