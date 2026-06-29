import { describe, expect, it } from "vitest";
import { recommendSkillForTask } from "../src/skill-recommender.js";

describe("Skill recommender", () => {
  it("recommends frontend-design for visual UI and layout work", () => {
    expect(
      recommendSkillForTask({
        activity: "Refining the companion overlay UI, canvas sprite, and CSS layout.",
        visibleSignals: ["overlay window", "CSS", "visual design"],
      })
    ).toEqual({
      skill: "frontend-design",
      confidence: "high",
      reason: "適合處理 UI、互動、視覺與版面調整。",
    });
  });

  it("uses prompt draft text when choosing an installed skill", () => {
    expect(
      recommendSkillForTask({
        prompt:
          "Fix the failing checkout test and diagnose why the payment mock crashes.",
      })
    ).toEqual({
      skill: "diagnose",
      confidence: "high",
      reason: "適合重現、定位並修復 bug 或測試失敗。",
    });
  });

  it("can skip the fallback when a draft has no useful skill signal yet", () => {
    expect(
      recommendSkillForTask(
        {
          prompt: "please help",
        },
        { allowFallback: false }
      )
    ).toBeNull();
  });

  it("recommends installed writing skills from prompt draft language", () => {
    expect(
      recommendSkillForTask({
        prompt: "幫我把這段中文文案去 AI 味，改寫得自然一點",
      })
    ).toEqual({
      skill: "humanizer-zh",
      confidence: "high",
      reason: "適合把中文文案改得更自然、降低 AI 味。",
    });
  });

  it("uses installed skill descriptions when ranking prompt drafts", () => {
    expect(
      recommendSkillForTask(
        {
          prompt: "fix the failing checkout test and find the smallest repro",
        },
        {
          skills: [
            {
              name: "diagnose",
              description:
                "Disciplined diagnosis loop for hard bugs, regressions, and failing tests.",
              path: "/skills/diagnose/SKILL.md",
            },
            {
              name: "write-a-prd",
              description: "Turn discussed requirements into a product spec.",
              path: "/skills/write-a-prd/SKILL.md",
            },
          ],
        }
      )
    ).toEqual({
      skill: "diagnose",
      confidence: "high",
      reason:
        "Disciplined diagnosis loop for hard bugs, regressions, and failing tests.",
    });
  });

  it("keeps failing-test prompts pointed at diagnose when multiple installed skills match", () => {
    expect(
      recommendSkillForTask(
        {
          prompt: "fix the failing checkout test",
        },
        {
          skills: [
            {
              name: "diagnose",
              description:
                "Disciplined diagnosis loop for hard bugs and regressions.",
              path: "/skills/diagnose/SKILL.md",
            },
            {
              name: "tdd",
              description:
                "Test-driven development with red-green-refactor loop. Use when fixing bugs or adding tests.",
              path: "/skills/tdd/SKILL.md",
            },
          ],
        }
      )
    ).toEqual({
      skill: "diagnose",
      confidence: "high",
      reason: "Disciplined diagnosis loop for hard bugs and regressions.",
    });
  });
});
