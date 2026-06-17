import { describe, expect, it } from "vitest";
import { createCompanionWorkInterpreter } from "../src/companion-work.js";

describe("Companion work interpreter", () => {
  it("turns local events into one behavior packet for companion surfaces", () => {
    const interpreter = createCompanionWorkInterpreter();

    const first = interpreter.observeEvent({
      type: "tool:finish",
      tool: "test",
      status: "failed",
    });
    const second = interpreter.observeEvent({
      type: "tool:finish",
      tool: "test",
      status: "failed",
    });

    expect(first).toMatchObject({
      state: "error",
      vibe: 42,
      lightTone: "blocked",
      workContext: {
        activity: "test-failure",
        suggestedSkill: "diagnose",
      },
      brainReaction: {
        quiet: true,
      },
    });
    expect(second).toMatchObject({
      state: "error",
      vibe: 22,
      lightTone: "blocked",
      workContext: {
        activity: "repeated-test-failure",
        friction: "high",
      },
      brainReaction: {
        quiet: false,
        speech: "連續測試失敗。用 diagnose 先縮小範圍。",
        gesture: "point",
      },
    });
  });
});
