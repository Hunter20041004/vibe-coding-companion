export function createSessionSummary(events = []) {
  const recentEvents = events.map(normalizeEvent).filter(Boolean).slice(-12);

  if (recentEvents.length === 0) {
    return {
      title: "等待工作開始",
      phase: "waiting",
      summary: "目前還沒有足夠事件可以判斷工作狀態。",
      signals: [],
      confidence: "low",
    };
  }

  const readCount = countStartedTool(recentEvents, "read");
  const editCount =
    countStartedTool(recentEvents, "edit") + countStartedTool(recentEvents, "write");
  const failedTestCount = countFinishedTests(recentEvents, "failed");
  const passedTestCount = countFinishedTests(recentEvents, "passed");
  const latestTestStatus = [...recentEvents]
    .reverse()
    .find((event) => event.type === "tool:finish" && event.tool === "test")
    ?.status;
  const latestDecision = [...recentEvents]
    .reverse()
    .find((event) => event.type === "ai:decision");
  const phase = derivePhase({ latestDecision, latestTestStatus, editCount });

  if (latestTestStatus === "failed") {
    return {
      title: "正在修測試失敗",
      phase,
      summary: "你剛讀過脈絡、改過程式，測試目前仍失敗。",
      signals: buildSignals({ readCount, editCount, failedTestCount, passedTestCount }),
      confidence: latestDecision ? "high" : "medium",
    };
  }

  if (latestTestStatus === "passed") {
    return {
      title: "剛通過測試",
      phase,
      summary: "最近的測試已通過，可以整理變更或補下一個小切片。",
      signals: buildSignals({ readCount, editCount, failedTestCount, passedTestCount }),
      confidence: latestDecision ? "high" : "medium",
    };
  }

  if (phase === "waiting") {
    return {
      title: "等待下一步",
      phase,
      summary: "目前沒有進行中的工具事件，等待下一個工作步驟。",
      signals: buildSignals({ readCount, editCount, failedTestCount, passedTestCount }),
      confidence: "medium",
    };
  }

  if (editCount > 0) {
    return {
      title: "正在修改程式",
      phase,
      summary: "你正在編輯程式，下一步適合用一個小測試確認變更。",
      signals: buildSignals({ readCount, editCount, failedTestCount, passedTestCount }),
      confidence: "medium",
    };
  }

  return {
    title: "正在理解脈絡",
    phase,
    summary: "目前主要是在讀取或整理資訊，還沒有看到測試結果。",
    signals: buildSignals({ readCount, editCount, failedTestCount, passedTestCount }),
    confidence: "medium",
  };
}

function normalizeEvent(item) {
  return item?.event ?? item;
}

function countStartedTool(events, tool) {
  return events.filter(
    (event) => event.type === "tool:start" && event.tool === tool
  ).length;
}

function countFinishedTests(events, status) {
  return events.filter(
    (event) =>
      event.type === "tool:finish" &&
      event.tool === "test" &&
      event.status === status
  ).length;
}

function derivePhase({ latestDecision, latestTestStatus, editCount }) {
  if (latestTestStatus === "passed") return "success";
  if (latestTestStatus === "failed") {
    return ["debugging", "error"].includes(latestDecision?.state)
      ? String(latestDecision.state)
      : "debugging";
  }

  if (latestDecision?.state) return String(latestDecision.state);
  if (editCount > 0) return "coding";
  return "reading";
}

function buildSignals({ readCount, editCount, failedTestCount, passedTestCount }) {
  return [
    readCount > 0 ? `read x${readCount}` : "",
    editCount > 0 ? `edit x${editCount}` : "",
    failedTestCount > 0 ? `test failed x${failedTestCount}` : "",
    passedTestCount > 0 ? `test passed x${passedTestCount}` : "",
  ].filter(Boolean);
}
