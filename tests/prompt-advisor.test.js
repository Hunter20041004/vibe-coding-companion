import { describe, expect, it } from "vitest";
import { createPromptDraftAdvice } from "../src/prompt-advisor.js";

describe("Prompt advisor", () => {
  it("stays quiet for very short drafts", () => {
    expect(createPromptDraftAdvice({ prompt: "fix" })).toBeNull();
  });

  it("returns only a high-confidence skill hint while the user drafts a bug prompt", () => {
    expect(
      createPromptDraftAdvice({
        prompt: "fix the failing checkout test, it crashes in CI",
      })
    ).toEqual({
      skillHint: {
        skill: "diagnose",
        confidence: "high",
        reason: "適合重現、定位並修復 bug 或測試失敗。",
        source: "prompt-draft",
        scenario: "bug",
        bubble: "先縮小錯誤範圍。可用 diagnose。",
      },
    });
  });

  it("returns a skill-only hint for UI prompt drafts", () => {
    expect(
      createPromptDraftAdvice({
        prompt: "調整 overlay UI layout，讓提示泡泡更像助手",
      })
    ).toEqual({
      skillHint: {
        skill: "frontend-design",
        confidence: "high",
        reason: "適合處理 UI、互動、視覺與版面調整。",
        source: "prompt-draft",
        scenario: "ui",
        bubble: "先檢查畫面狀態。可用 frontend-design。",
      },
    });
  });

  it("stays quiet when a broad draft has no high-confidence skill", () => {
    expect(
      createPromptDraftAdvice({
        prompt: "improve this feature and make the code better",
      })
    ).toBeNull();
  });

  it("keeps character presentation from changing the selected skill", () => {
    const advice = createPromptDraftAdvice({
      prompt: "fix the failing checkout test, it crashes in CI",
      characterId: "green-phosphor-pixel",
    });

    expect(advice).toEqual(
      expect.objectContaining({
        skillHint: expect.objectContaining({
          skill: "diagnose",
          confidence: "high",
          source: "prompt-draft",
          scenario: "bug",
          characterId: "green-phosphor-pixel",
        }),
      })
    );
  });
});
