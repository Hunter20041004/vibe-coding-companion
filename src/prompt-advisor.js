import { recommendSkillForTask } from "./skill-recommender.js";
const MIN_DRAFT_CHARS = 18;
const HIGH_CONFIDENCE = "high";
const SKILL_BUBBLES = {
  diagnose: {
    bubble: "先縮小錯誤範圍。可用 diagnose。",
    scenario: "bug",
  },
  "frontend-design": {
    bubble: "先檢查畫面狀態。可用 frontend-design。",
    scenario: "ui",
  },
  tdd: {
    bubble: "先切一個小測試。可用 tdd。",
    scenario: "test",
  },
  prototype: {
    bubble: "先做可玩原型。可用 prototype。",
    scenario: "prototype",
  },
  "write-a-prd": {
    bubble: "先整理需求範圍。可用 write-a-prd。",
    scenario: "planning",
  },
  "openai-docs": {
    bubble: "先查官方文件。可用 openai-docs。",
    scenario: "docs",
  },
};

export function createPromptDraftAdvice({ prompt, skills = [], characterId = null } = {}) {
  const draft = normalizeDraft(prompt);
  if (draft.length < MIN_DRAFT_CHARS) {
    return null;
  }

  const skillHint =
    recommendSkillForTask(
      { prompt: draft },
      { allowFallback: false, skills }
    );
  const presentableHint = createPresentableSkillHint(skillHint, draft, characterId);

  return presentableHint ? { skillHint: presentableHint } : null;
}

export function createPresentableSkillHint(skillHint, draft = "", characterId = null) {
  if (!skillHint || skillHint.confidence !== HIGH_CONFIDENCE) return null;

  const skill = String(skillHint.skill ?? "").trim();
  if (!skill) return null;
  const presentation = SKILL_BUBBLES[skill] ?? {
    bubble: `先切到合適流程。可用 ${truncateSkillName(skill)}。`,
    scenario: scenarioForDraft(draft),
  };

  return {
    ...skillHint,
    source: skillHint.source ?? "prompt-draft",
    scenario: skillHint.scenario ?? presentation.scenario,
    bubble: skillHint.bubble ?? presentation.bubble,
    ...(characterId
      ? {
          characterId,
          presentation: {
            characterId,
            bubble: skillHint.bubble ?? presentation.bubble,
          },
        }
      : {}),
  };
}

function normalizeDraft(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function scenarioForDraft(draft) {
  if (looksLikeBugWork(draft)) return "bug";
  if (looksLikeUiWork(draft)) return "ui";
  if (hasVerificationSignal(draft)) return "test";
  if (looksLikeImplementation(draft)) return "implementation";
  return "unknown";
}

function truncateSkillName(skill) {
  return skill.length > 28 ? `${skill.slice(0, 27)}…` : skill;
}

function looksLikeBugWork(draft) {
  return hasAny(draft, [
    "bug",
    "broken",
    "crash",
    "error",
    "failed",
    "failing",
    "failure",
    "debug",
    "錯誤",
    "壞掉",
    "失敗",
    "除錯",
    "修 bug",
  ]);
}

function looksLikeUiWork(draft) {
  return hasAny(draft, [
    "ui",
    "ux",
    "css",
    "layout",
    "visual",
    "component",
    "overlay",
    "responsive",
    "animation",
    "畫面",
    "介面",
    "視覺",
    "版面",
    "互動",
    "動畫",
  ]);
}

function looksLikeImplementation(draft) {
  return hasAny(draft, [
    "implement",
    "build",
    "add",
    "create",
    "fix",
    "change",
    "update",
    "feature",
    "實作",
    "新增",
    "建立",
    "修正",
    "調整",
    "功能",
  ]);
}

function hasVerificationSignal(draft) {
  return hasAny(draft, [
    "test",
    "verify",
    "check",
    "coverage",
    "acceptance",
    "done when",
    "測試",
    "驗證",
    "檢查",
    "完成條件",
  ]);
}

function hasAny(draft, keywords) {
  const lowerDraft = draft.toLowerCase();
  return keywords.some((keyword) => lowerDraft.includes(keyword.toLowerCase()));
}
