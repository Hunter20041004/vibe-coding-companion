import { describe, expect, it } from "vitest";
import { createNextStepAdvice } from "../src/next-step-advice.js";

describe("Next-step advice", () => {
  it("turns repeated failed tests into a concrete diagnose action", () => {
    expect(
      createNextStepAdvice({
        state: "error",
        event: {
          type: "tool:finish",
          tool: "test",
          status: "failed",
        },
        recentEvents: [
          { type: "tool:finish", tool: "test", status: "failed" },
          { type: "tool:finish", tool: "test", status: "failed" },
        ],
      })
    ).toEqual({
      title: "先縮小測試失敗範圍",
      action: "用 diagnose 重現最小失敗案例，再分辨是產品邏輯還是測試假設壞掉。",
      reason: "最近連續 2 次測試失敗。",
      skill: "diagnose",
      priority: "high",
      speakable: true,
    });
  });

  it("suggests a minimal test after several edits without test feedback", () => {
    expect(
      createNextStepAdvice({
        state: "coding",
        recentEvents: [
          { type: "tool:start", tool: "edit" },
          { type: "tool:start", tool: "write" },
          { type: "tool:start", tool: "edit" },
        ],
      })
    ).toEqual({
      title: "先跑一個最小測試",
      action: "用 TDD 補一個能驗證剛剛修改的最小測試，避免改太遠才回頭查。",
      reason: "最近有 3 次修改，但還沒有看到測試結果。",
      skill: "tdd",
      priority: "medium",
      speakable: false,
    });
  });

  it("suggests cleanup after a failed test recovers to passed", () => {
    expect(
      createNextStepAdvice({
        state: "success",
        recentEvents: [
          { type: "tool:finish", tool: "test", status: "failed" },
          { type: "tool:start", tool: "edit" },
          { type: "tool:finish", tool: "test", status: "passed" },
        ],
      })
    ).toEqual({
      title: "整理剛修好的變更",
      action: "檢查 diff、移除臨時修改，然後決定要提交或切下一個 TDD 小步驟。",
      reason: "最近的測試已從失敗恢復成通過。",
      skill: "tdd",
      priority: "medium",
      speakable: true,
    });
  });

  it("suggests frontend visual verification for UI work", () => {
    expect(
      createNextStepAdvice({
        state: "coding",
        event: {
          type: "tool:start",
          tool: "edit",
          path: "src/overlay.css",
        },
        recentEvents: [
          { type: "tool:start", tool: "edit", path: "src/overlay.css" },
          { type: "tool:start", tool: "read", path: "src/overlay.js" },
        ],
        skillHint: {
          skill: "frontend-design",
          confidence: "high",
          reason: "適合處理 UI、互動、視覺與版面調整。",
        },
      })
    ).toEqual({
      title: "做一次視覺驗證",
      action: "用 frontend-design 檢查版面，跑截圖確認沒有重疊、遮擋或過度干擾。",
      reason: "目前修改看起來會影響 UI 或 overlay 視覺。",
      skill: "frontend-design",
      priority: "medium",
      speakable: true,
    });
  });

  it("keeps waiting advice quiet and focused on choosing the next step", () => {
    expect(
      createNextStepAdvice({
        state: "waiting",
        event: {
          type: "ai:decision",
          state: "waiting",
        },
        recentEvents: [
          { type: "ai:decision", state: "waiting" },
        ],
      })
    ).toEqual({
      title: "選一個下一步",
      action: "先用一句話整理目前狀態，再決定要測試、提交，或切下一個小任務。",
      reason: "目前處於 waiting，沒有進行中的工具事件。",
      skill: "tdd",
      priority: "low",
      speakable: false,
    });
  });

  it("keeps generic skill-hint advice in the fixed playbook shape", () => {
    expect(
      createNextStepAdvice({
        state: "debugging",
        skillHint: {
          skill: "diagnose",
          confidence: "high",
          reason: "適合重現、定位並修復 bug 或測試失敗。",
        },
      })
    ).toEqual({
      title: "下一步可用 diagnose",
      action: "適合重現、定位並修復 bug 或測試失敗。",
      reason: "目前狀態是 debugging。",
      skill: "diagnose",
      priority: "medium",
      speakable: false,
    });
  });
});
