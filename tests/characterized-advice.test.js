import { describe, expect, it } from "vitest";
import {
  characterizeAdvice,
  rankAdviceForCharacter,
} from "../src/characterized-advice.js";

describe("Characterized advice", () => {
  it("adds a gentle presentation without changing the core advice contract", () => {
    const coreAdvice = {
      title: "Prompt 草稿可補重現線索",
      action: "補上錯誤訊息、重現步驟或測試指令。",
      reason: "草稿看起來是在修 bug，但還缺少可重現的線索。",
      skill: "diagnose",
      priority: "medium",
      speakable: true,
    };

    expect(characterizeAdvice(coreAdvice, "foam-ghost")).toEqual({
      ...coreAdvice,
      presentation: {
        characterId: "foam-ghost",
        title: "慢慢來：Prompt 草稿可補重現線索",
        action:
          "先不用急，補上錯誤訊息、重現步驟或測試指令。 也可以先用 Dashboard textarea。",
        bubble: "慢慢來：補上錯誤訊息、重現步驟或測試指令。",
      },
    });
  });

  it("falls back to the default character presentation for invalid ids", () => {
    const coreAdvice = {
      title: "選一個下一步",
      action: "先整理目前狀態，再切一個小任務。",
      reason: "目前處於 waiting。",
      skill: "tdd",
      priority: "low",
    };

    expect(characterizeAdvice(coreAdvice, "not-installed")).toEqual(
      expect.objectContaining({
        skill: "tdd",
        priority: "low",
        reason: "目前處於 waiting。",
        presentation: expect.objectContaining({
          characterId: "cosmic-jellyfish",
          title: "先定錨：選一個下一步",
        }),
      })
    );
  });

  it("reorders same-priority advice by each character bias without changing priority", () => {
    const advice = [
      {
        title: "做一次視覺驗證",
        action: "用 frontend-design 跑桌面和窄版截圖。",
        reason: "目前修改看起來會影響 UI。",
        skill: "frontend-design",
        priority: "medium",
      },
      {
        title: "先縮小測試失敗範圍",
        action: "用 diagnose 重現最小失敗案例。",
        reason: "最近連續 2 次測試失敗。",
        skill: "diagnose",
        priority: "medium",
      },
      {
        title: "補上目標檔案和範圍",
        action: "把工作拆成下一個可驗證小步驟。",
        reason: "草稿目標偏寬。",
        skill: "tdd",
        priority: "medium",
      },
    ];

    expect(rankAdviceForCharacter(advice, "cosmic-jellyfish")[0].title).toBe(
      "補上目標檔案和範圍"
    );
    expect(rankAdviceForCharacter(advice, "green-phosphor-pixel")[0].title)
      .toBe("先縮小測試失敗範圍");
    expect(
      rankAdviceForCharacter(advice, "green-phosphor-pixel").map(
        (item) => item.priority
      )
    ).toEqual(["medium", "medium", "medium"]);
  });
});
