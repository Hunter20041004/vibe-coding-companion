export function createNextStepAdvice({
  state = "waiting",
  event = {},
  recentEvents = [],
  skillHint = null,
} = {}) {
  const eventWindow = recentEvents.length ? recentEvents : [event];
  const failedTestCount = countFailedTests(eventWindow);
  const editCount = countEdits(eventWindow);
  const finishedTestCount = countFinishedTests(eventWindow);
  const latestTestStatus = getLatestTestStatus(eventWindow);

  if (failedTestCount >= 2) {
    return {
      title: "先縮小測試失敗範圍",
      action:
        "用 diagnose 重現最小失敗案例，再分辨是產品邏輯還是測試假設壞掉。",
      reason: `最近連續 ${failedTestCount} 次測試失敗。`,
      skill: "diagnose",
      priority: "high",
      speakable: true,
    };
  }

  if (editCount >= 3 && finishedTestCount === 0) {
    return {
      title: "先跑一個最小測試",
      action: "用 TDD 補一個能驗證剛剛修改的最小測試，避免改太遠才回頭查。",
      reason: `最近有 ${editCount} 次修改，但還沒有看到測試結果。`,
      skill: "tdd",
      priority: "medium",
      speakable: false,
    };
  }

  if (latestTestStatus === "passed" && failedTestCount > 0) {
    return {
      title: "整理剛修好的變更",
      action: "檢查 diff、移除臨時修改，然後決定要提交或切下一個 TDD 小步驟。",
      reason: "最近的測試已從失敗恢復成通過。",
      skill: "tdd",
      priority: "medium",
      speakable: true,
    };
  }

  if (isUiWork({ event, recentEvents: eventWindow, skillHint })) {
    return {
      title: "做一次視覺驗證",
      action: "用 frontend-design 檢查版面，跑截圖確認沒有重疊、遮擋或過度干擾。",
      reason: "目前修改看起來會影響 UI 或 overlay 視覺。",
      skill: "frontend-design",
      priority: "medium",
      speakable: true,
    };
  }

  if (state === "waiting" || event?.state === "waiting") {
    return {
      title: "選一個下一步",
      action: "先用一句話整理目前狀態，再決定要測試、提交，或切下一個小任務。",
      reason: "目前處於 waiting，沒有進行中的工具事件。",
      skill: "tdd",
      priority: "low",
      speakable: false,
    };
  }

  if (skillHint?.skill) {
    return {
      title: `下一步可用 ${skillHint.skill}`,
      action: String(skillHint.reason ?? "先用這個 skill 拆一個小步驟。"),
      reason: `目前狀態是 ${String(state)}。`,
      skill: String(skillHint.skill),
      priority: skillHint.confidence === "high" ? "medium" : "low",
      speakable: false,
    };
  }

  return {
    title: "先切一個小步驟",
    action: "用 TDD 先寫一個能驗證目前目標的小測試。",
    reason: `目前狀態是 ${String(state)}。`,
    skill: "tdd",
    priority: "low",
    speakable: false,
  };
}

function countFailedTests(events) {
  return events.filter(
    (event) =>
      event?.type === "tool:finish" &&
      event.tool === "test" &&
      event.status === "failed"
  ).length;
}

function countEdits(events) {
  return events.filter(
    (event) =>
      event?.type === "tool:start" &&
      ["edit", "write"].includes(event.tool)
  ).length;
}

function countFinishedTests(events) {
  return events.filter(
    (event) => event?.type === "tool:finish" && event.tool === "test"
  ).length;
}

function getLatestTestStatus(events) {
  return [...events]
    .reverse()
    .find((event) => event?.type === "tool:finish" && event.tool === "test")
    ?.status;
}

function isUiWork({ event, recentEvents, skillHint }) {
  if (skillHint?.skill === "frontend-design") return true;

  const haystack = [event, ...recentEvents]
    .flatMap((item) => [item?.path, item?.file, item?.line, item?.tool])
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return [
    ".css",
    ".scss",
    "ui",
    "layout",
    "overlay",
    "animation",
    "visual",
    "canvas",
  ].some((keyword) => haystack.includes(keyword));
}
