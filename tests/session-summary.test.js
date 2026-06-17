import { describe, expect, it } from "vitest";
import { createSessionSummary } from "../src/session-summary.js";

describe("Session summary", () => {
  it("summarizes a test-fix loop from recent work events", () => {
    expect(
      createSessionSummary([
        { type: "prompt:submitted" },
        { type: "tool:start", tool: "read" },
        { type: "tool:start", tool: "edit" },
        { type: "tool:start", tool: "test" },
        { type: "tool:finish", tool: "test", status: "failed" },
        {
          type: "ai:decision",
          state: "debugging",
          line: "Tests are failing after the latest edit.",
          skillHint: { skill: "diagnose" },
        },
      ])
    ).toEqual({
      title: "正在修測試失敗",
      phase: "debugging",
      summary: "你剛讀過脈絡、改過程式，測試目前仍失敗。",
      signals: ["read x1", "edit x1", "test failed x1"],
      confidence: "high",
    });
  });

  it("summarizes a recovered test loop from the latest test result", () => {
    expect(
      createSessionSummary([
        { type: "tool:start", tool: "read" },
        { type: "tool:start", tool: "edit" },
        { type: "tool:finish", tool: "test", status: "failed" },
        { type: "tool:start", tool: "edit" },
        { type: "tool:finish", tool: "test", status: "passed" },
        { type: "ai:decision", state: "success" },
      ])
    ).toEqual({
      title: "剛通過測試",
      phase: "success",
      summary: "最近的測試已通過，可以整理變更或補下一個小切片。",
      signals: ["read x1", "edit x2", "test failed x1", "test passed x1"],
      confidence: "high",
    });
  });

  it("keeps a passed latest test in success even when an older error decision arrives late", () => {
    expect(
      createSessionSummary([
        { type: "tool:finish", tool: "test", status: "failed" },
        { type: "tool:finish", tool: "test", status: "passed" },
        { type: "ai:decision", sourceEventId: 1, state: "error" },
      ])
    ).toEqual({
      title: "剛通過測試",
      phase: "success",
      summary: "最近的測試已通過，可以整理變更或補下一個小切片。",
      signals: ["test failed x1", "test passed x1"],
      confidence: "high",
    });
  });

  it("summarizes an explicit waiting decision as ready for the next step", () => {
    expect(
      createSessionSummary([
        {
          type: "ai:decision",
          state: "waiting",
        },
      ])
    ).toEqual({
      title: "等待下一步",
      phase: "waiting",
      summary: "目前沒有進行中的工具事件，等待下一個工作步驟。",
      signals: [],
      confidence: "medium",
    });
  });
});
