import { describe, expect, it } from "vitest";
import { createPromptDraftAdvice } from "../src/prompt-advisor.js";

describe("Prompt advisor", () => {
  it("stays quiet for very short drafts", () => {
    expect(createPromptDraftAdvice({ prompt: "fix" })).toBeNull();
  });

  it("suggests diagnose details while the user drafts a bug prompt", () => {
    expect(
      createPromptDraftAdvice({
        prompt: "fix the failing checkout test, it crashes in CI",
      })
    ).toEqual({
      title: "Prompt 草稿可補重現線索",
      action: "補上錯誤訊息、重現步驟或測試指令。",
      reason: "草稿看起來是在修 bug，但還缺少可重現的線索。",
      skill: "diagnose",
      priority: "medium",
      speakable: true,
      skillHint: {
        skill: "diagnose",
        confidence: "high",
        reason: "適合重現、定位並修復 bug 或測試失敗。",
      },
    });
  });

  it("suggests visual verification for UI prompt drafts", () => {
    expect(
      createPromptDraftAdvice({
        prompt: "調整 overlay UI layout，讓提示泡泡更像助手",
      })
    ).toEqual(
      expect.objectContaining({
        title: "Prompt 草稿可補視覺驗證",
        action: "補上桌面/窄版截圖檢查，確認沒有重疊或遮擋。",
        skill: "frontend-design",
      })
    );
  });

  it("suggests scope for broad drafts before recommending a fallback skill", () => {
    expect(
      createPromptDraftAdvice({
        prompt: "improve this feature and make the code better",
      })
    ).toEqual(
      expect.objectContaining({
        title: "Prompt 草稿可補範圍",
        action: "補上目標檔案、頁面、模組或要保留的限制。",
        skill: "tdd",
      })
    );
  });

  it("adds character presentation when prompt advice is requested for an active character", () => {
    const advice = createPromptDraftAdvice({
      prompt: "fix the failing checkout test, it crashes in CI",
      characterId: "green-phosphor-pixel",
    });

    expect(advice).toEqual(
      expect.objectContaining({
        title: "Prompt 草稿可補重現線索",
        action: "補上錯誤訊息、重現步驟或測試指令。",
        reason: "草稿看起來是在修 bug，但還缺少可重現的線索。",
        skill: "diagnose",
        priority: "medium",
        presentation: {
          characterId: "green-phosphor-pixel",
          title: "跑指令：Prompt 草稿可補重現線索",
          action: "命令列節奏：補上錯誤訊息、重現步驟或測試指令。",
          bubble: "跑指令：補上錯誤訊息、重現步驟或測試指令。",
        },
      })
    );
  });
});
