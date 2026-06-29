import { recommendSkillForTask } from "./skill-recommender.js";
import { characterizeAdvice } from "./characterized-advice.js";

const MIN_DRAFT_CHARS = 18;

export function createPromptDraftAdvice({ prompt, skills = [], characterId = null } = {}) {
  const draft = normalizeDraft(prompt);
  if (draft.length < MIN_DRAFT_CHARS) {
    return null;
  }

  const skillHint =
    recommendSkillForTask(
      { prompt: draft },
      { allowFallback: false, skills }
    ) ??
    fallbackSkillForDraft(draft);
  const rule = choosePromptRule(draft);

  const advice = {
    ...rule,
    skill: skillHint?.skill ?? "tdd",
    priority: "medium",
    speakable: true,
    ...(skillHint ? { skillHint } : {}),
  };

  return characterId ? characterizeAdvice(advice, characterId) : advice;
}

function choosePromptRule(draft) {
  if (looksLikeBugWork(draft) && !hasReproSignal(draft)) {
    return {
      title: "Prompt 草稿可補重現線索",
      action: "補上錯誤訊息、重現步驟或測試指令。",
      reason: "草稿看起來是在修 bug，但還缺少可重現的線索。",
    };
  }

  if (looksLikeUiWork(draft) && !hasVisualVerification(draft)) {
    return {
      title: "Prompt 草稿可補視覺驗證",
      action: "補上桌面/窄版截圖檢查，確認沒有重疊或遮擋。",
      reason: "草稿看起來會改 UI，但還沒有明確驗證方式。",
    };
  }

  if (looksBroad(draft) && !hasScopeSignal(draft)) {
    return {
      title: "Prompt 草稿可補範圍",
      action: "補上目標檔案、頁面、模組或要保留的限制。",
      reason: "草稿目標偏寬，範圍越明確越容易得到穩定結果。",
    };
  }

  if (looksLikeImplementation(draft) && !hasVerificationSignal(draft)) {
    return {
      title: "Prompt 草稿可補驗證方式",
      action: "補上要跑的測試、手動檢查或完成條件。",
      reason: "草稿已經有方向，但還缺少完成後如何驗證。",
    };
  }

  return {
    title: "Prompt 草稿可更具體",
    action: "補一句目標、範圍、限制和驗證方式。",
    reason: "草稿有足夠長度，但還可以再降低來回確認成本。",
  };
}

function fallbackSkillForDraft(draft) {
  if (looksLikeImplementation(draft) || hasVerificationSignal(draft)) {
    return recommendSkillForTask({ prompt: draft });
  }

  return {
    skill: "tdd",
    confidence: "low",
    reason: "不確定時先用 TDD 拆一個小的可驗證切片。",
  };
}

function normalizeDraft(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
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

function looksBroad(draft) {
  return hasAny(draft, [
    "improve",
    "refactor",
    "rewrite",
    "better",
    "clean up",
    "make",
    "優化",
    "改善",
    "重構",
    "整理",
    "變好",
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

function hasReproSignal(draft) {
  return hasAny(draft, [
    "repro",
    "reproduce",
    "steps",
    "expected",
    "actual",
    "stack trace",
    "npm test",
    "vitest",
    "playwright",
    "重現",
    "步驟",
    "預期",
    "實際",
    "錯誤訊息",
    "測試指令",
  ]);
}

function hasVisualVerification(draft) {
  return hasAny(draft, [
    "screenshot",
    "viewport",
    "desktop",
    "mobile",
    "responsive",
    "overlap",
    "clipped",
    "截圖",
    "桌面",
    "手機",
    "窄版",
    "重疊",
    "遮擋",
    "截斷",
  ]);
}

function hasScopeSignal(draft) {
  return /[\w./-]+\.(js|ts|tsx|jsx|css|html|md|json)\b/i.test(draft) ||
    hasAny(draft, [
      "file",
      "module",
      "component",
      "page",
      "keep",
      "only",
      "don't",
      "do not",
      "不要",
      "只",
      "檔案",
      "模組",
      "元件",
      "頁面",
      "保留",
      "限制",
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
