import { getCharacterProfile, normalizeCharacterId } from "./character-profiles.js";

const PRIORITY_RANK = {
  high: 3,
  medium: 2,
  low: 1,
};

export function characterizeAdvice(advice, characterId) {
  if (!advice) return null;

  const normalizedCharacterId = normalizeCharacterId(characterId);
  const profile = getCharacterProfile(normalizedCharacterId);
  const title = String(advice.title ?? "下一步建議");
  const action = String(advice.action ?? "先切一個小步驟。");

  return {
    ...advice,
    presentation: {
      characterId: profile.id,
      title: `${profile.voice.prefix}${title}`,
      action: createDisplayAction({ action, profile }),
      bubble: `${profile.voice.prefix}${shortenAction(action)}`,
    },
  };
}

export function rankAdviceForCharacter(adviceList = [], characterId) {
  const normalizedCharacterId = normalizeCharacterId(characterId);
  return [...adviceList].sort((left, right) => {
    const priorityDelta = priorityValue(right) - priorityValue(left);
    if (priorityDelta !== 0) return priorityDelta;

    return (
      biasScore(right, normalizedCharacterId) -
      biasScore(left, normalizedCharacterId)
    );
  });
}

function createDisplayAction({ action, profile }) {
  if (profile.coachingBias === "gentle") {
    return `先不用急，${action} 也可以先用 Dashboard textarea。`;
  }

  if (profile.coachingBias === "testing") {
    return `命令列節奏：${action}`;
  }

  return `把範圍收成下一個可驗證步驟：${action}`;
}

function shortenAction(action) {
  return action.split("。")[0] + "。";
}

function priorityValue(advice) {
  return PRIORITY_RANK[String(advice?.priority ?? "low")] ?? 0;
}

function biasScore(advice, characterId) {
  const text = [advice?.title, advice?.action, advice?.reason, advice?.skill]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (characterId === "green-phosphor-pixel") {
    return scoreTerms(text, [
      "test",
      "測試",
      "failed",
      "失敗",
      "repro",
      "重現",
      "diagnose",
      "command",
      "指令",
    ]);
  }

  if (characterId === "foam-ghost") {
    return scoreTerms(text, [
      "permission",
      "權限",
      "readiness",
      "修復",
      "fallback",
      "textarea",
      "太寬",
      "溫和",
    ]);
  }

  return scoreTerms(text, [
    "scope",
    "範圍",
    "下一步",
    "小步驟",
    "拆",
    "目標",
    "navigation",
  ]);
}

function scoreTerms(text, terms) {
  return terms.reduce(
    (score, term) => score + (text.includes(term.toLowerCase()) ? 1 : 0),
    0
  );
}
