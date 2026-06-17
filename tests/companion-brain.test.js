import { describe, expect, it } from "vitest";
import { createCompanionBrain } from "../src/companion-brain.js";

describe("Companion brain", () => {
  it("turns next-step advice into the primary companion speech", () => {
    const brain = createCompanionBrain({ getNow: () => 1000 });

    expect(
      brain.react({
        type: "ai:decision",
        state: "debugging",
        intensity: "high",
        motion: "panic",
        line: "Tests are being dramatic.",
        skillHint: {
          skill: "diagnose",
          confidence: "high",
          reason: "適合重現、定位並修復 bug 或測試失敗。",
        },
        nextStepAdvice: {
          title: "先縮小測試失敗範圍",
          action:
            "用 diagnose 重現最小失敗案例，再分辨是產品邏輯還是測試假設壞掉。",
          reason: "最近連續 2 次測試失敗。",
          skill: "diagnose",
          priority: "high",
        },
      })
    ).toEqual({
      state: "debugging",
      speech: "用 diagnose：重現最小失敗案例。",
      gesture: "point",
      priority: "high",
      ttlMs: 4200,
      quiet: false,
    });
  });

  it("turns a failing-test skill hint into a short actionable companion line", () => {
    const brain = createCompanionBrain({ getNow: () => 1000 });

    expect(
      brain.react({
        type: "ai:decision",
        state: "debugging",
        intensity: "high",
        motion: "panic",
        line: "Tests are being dramatic.",
        skillHint: {
          skill: "diagnose",
          confidence: "high",
          reason: "適合重現、定位並修復 bug 或測試失敗。",
        },
      })
    ).toEqual({
      state: "debugging",
      speech: "用 diagnose。先重現錯誤，再縮小範圍。",
      gesture: "point",
      priority: "high",
      ttlMs: 4200,
      quiet: false,
    });
  });

  it("stays quiet when the same speech repeats during cooldown", () => {
    let now = 1000;
    const brain = createCompanionBrain({ getNow: () => now });
    const event = {
      type: "ai:decision",
      state: "debugging",
      intensity: "high",
      skillHint: {
        skill: "diagnose",
        confidence: "high",
      },
    };

    expect(brain.react(event).quiet).toBe(false);

    now = 3000;

    expect(brain.react(event)).toEqual({
      state: "debugging",
      speech: "",
      gesture: "idle",
      priority: "low",
      ttlMs: 0,
      quiet: true,
    });
  });

  it("stays quiet for low-priority next-step advice", () => {
    const brain = createCompanionBrain({ getNow: () => 5000 });

    expect(
      brain.react({
        type: "ai:decision",
        state: "coding",
        intensity: "medium",
        line: "Editing files.",
        skillHint: {
          skill: "tdd",
          confidence: "low",
        },
        nextStepAdvice: {
          title: "先切一個小步驟",
          action: "用 TDD 先寫一個能驗證目前目標的小測試。",
          skill: "tdd",
          priority: "low",
        },
      })
    ).toEqual({
      state: "coding",
      speech: "",
      gesture: "idle",
      priority: "low",
      ttlMs: 0,
      quiet: true,
    });
  });

  it("stays quiet when next-step advice is explicitly not speakable", () => {
    const brain = createCompanionBrain({ getNow: () => 5500 });

    expect(
      brain.react({
        type: "ai:decision",
        state: "success",
        intensity: "medium",
        nextStepAdvice: {
          title: "整理剛修好的變更",
          action: "檢查 diff、移除臨時修改，然後決定要提交或切下一個 TDD 小步驟。",
          skill: "tdd",
          priority: "medium",
          speakable: false,
        },
      })
    ).toEqual({
      state: "success",
      speech: "",
      gesture: "idle",
      priority: "low",
      ttlMs: 0,
      quiet: true,
    });
  });

  it("lets speakable next-step advice override low-friction coding quiet mode", () => {
    const brain = createCompanionBrain({ getNow: () => 6000 });

    expect(
      brain.react(
        {
          type: "ai:decision",
          state: "coding",
          intensity: "medium",
          nextStepAdvice: {
            title: "做一次視覺驗證",
            action: "用 frontend-design 檢查版面，跑截圖確認沒有重疊、遮擋或過度干擾。",
            skill: "frontend-design",
            priority: "medium",
            speakable: true,
          },
        },
        {
          activity: "editing",
          phase: "coding",
          friction: "low",
          suggestedSkill: "frontend-design",
          recentFailureCount: 0,
          recentEditCount: 3,
          lastMeaningfulEventAt: 5800,
        }
      )
    ).toEqual({
      state: "coding",
      speech: "用 frontend-design：檢查版面。",
      gesture: "point",
      priority: "medium",
      ttlMs: 3600,
      quiet: false,
    });
  });

  it("uses high-friction work context to give a more useful debugging suggestion", () => {
    const brain = createCompanionBrain({ getNow: () => 9000 });

    expect(
      brain.react(
        {
          type: "ai:decision",
          state: "debugging",
          intensity: "medium",
          line: "Tests are failing again.",
        },
        {
          activity: "repeated-test-failure",
          phase: "debugging",
          friction: "high",
          suggestedSkill: "diagnose",
          recentFailureCount: 2,
          recentEditCount: 0,
          lastMeaningfulEventAt: 8000,
        }
      )
    ).toEqual({
      state: "debugging",
      speech: "連續測試失敗。用 diagnose 先縮小範圍。",
      gesture: "point",
      priority: "high",
      ttlMs: 4200,
      quiet: false,
    });
  });

  it("can react from high-friction context even before an AI decision arrives", () => {
    const brain = createCompanionBrain({ getNow: () => 10000 });

    expect(
      brain.react(
        {
          type: "tool:finish",
          tool: "test",
          status: "failed",
          state: "error",
        },
        {
          activity: "repeated-test-failure",
          phase: "debugging",
          friction: "high",
          suggestedSkill: "diagnose",
          recentFailureCount: 2,
          recentEditCount: 0,
          lastMeaningfulEventAt: 9500,
        }
      ).speech
    ).toBe("連續測試失敗。用 diagnose 先縮小範圍。");
  });

  it("stays quiet during low-friction repeated coding work", () => {
    const brain = createCompanionBrain({ getNow: () => 12000 });

    expect(
      brain.react(
        {
          type: "ai:decision",
          state: "coding",
          intensity: "medium",
          line: "Editing files.",
        },
        {
          activity: "editing",
          phase: "coding",
          friction: "low",
          suggestedSkill: "",
          recentFailureCount: 0,
          recentEditCount: 3,
          lastMeaningfulEventAt: 11000,
        }
      )
    ).toEqual({
      state: "coding",
      speech: "",
      gesture: "idle",
      priority: "low",
      ttlMs: 0,
      quiet: true,
    });
  });
});
