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
});
