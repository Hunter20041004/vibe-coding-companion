import { describe, expect, it } from "vitest";
import { createWorkContextTracker } from "../src/work-context.js";

describe("Work context tracker", () => {
  it("recognizes repeated failed tests as high-friction debugging work", () => {
    let now = 1000;
    const tracker = createWorkContextTracker({ getNow: () => now });

    tracker.observe({ type: "tool:start", tool: "test" });
    now = 2000;
    tracker.observe({
      type: "tool:finish",
      tool: "test",
      status: "failed",
    });
    now = 3000;
    tracker.observe({
      type: "tool:finish",
      tool: "test",
      status: "failed",
    });

    expect(tracker.current()).toEqual({
      activity: "repeated-test-failure",
      phase: "debugging",
      friction: "high",
      suggestedSkill: "diagnose",
      recentFailureCount: 2,
      recentEditCount: 0,
      lastMeaningfulEventAt: 3000,
    });
  });

  it("recognizes repeated edits as low-friction coding work", () => {
    let now = 4000;
    const tracker = createWorkContextTracker({ getNow: () => now });

    tracker.observe({ type: "tool:start", tool: "edit" });
    now = 5000;
    tracker.observe({ type: "tool:start", tool: "write" });

    expect(tracker.current()).toEqual({
      activity: "editing",
      phase: "coding",
      friction: "low",
      suggestedSkill: "",
      recentFailureCount: 0,
      recentEditCount: 2,
      lastMeaningfulEventAt: 5000,
    });
  });

  it("carries AI decision skill hints into the current work context", () => {
    const tracker = createWorkContextTracker({ getNow: () => 7000 });

    tracker.observe({
      type: "ai:decision",
      state: "coding",
      line: "Refining overlay layout.",
      skillHint: {
        skill: "frontend-design",
        confidence: "high",
      },
    });

    expect(tracker.current()).toEqual({
      activity: "ai-decision",
      phase: "coding",
      friction: "low",
      suggestedSkill: "frontend-design",
      recentFailureCount: 0,
      recentEditCount: 0,
      lastMeaningfulEventAt: 7000,
    });
  });

  it("lets a newer AI decision override earlier low-friction edit context", () => {
    let now = 8000;
    const tracker = createWorkContextTracker({ getNow: () => now });

    tracker.observe({ type: "tool:start", tool: "edit" });
    now = 9000;
    tracker.observe({
      type: "ai:decision",
      state: "coding",
      skillHint: {
        skill: "frontend-design",
      },
    });

    expect(tracker.current()).toMatchObject({
      activity: "ai-decision",
      phase: "coding",
      suggestedSkill: "frontend-design",
      recentEditCount: 1,
      lastMeaningfulEventAt: 9000,
    });
  });
});
