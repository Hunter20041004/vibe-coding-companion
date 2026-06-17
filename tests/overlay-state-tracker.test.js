import { describe, expect, it } from "vitest";
import { createOverlayStateTracker } from "../src/overlay-state-tracker.js";

describe("Overlay state tracker", () => {
  it("tracks current agent state from local companion events", async () => {
    const tracker = createOverlayStateTracker({
      eventUrl: "http://127.0.0.1:5174/events",
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          events: [{ id: 1, event: { type: "tool:start", tool: "edit" } }],
        }),
      }),
    });

    expect(tracker.current()).toBe("idle");

    await tracker.pollOnce();

    expect(tracker.current()).toBe("coding");
  });

  it("settles transient error and success reactions back to waiting", () => {
    let now = 1000;
    const tracker = createOverlayStateTracker({
      eventUrl: null,
      getNow: () => now,
      transientMs: 1400,
    });

    tracker.sendEvent({
      type: "ai:decision",
      state: "error",
      intensity: "high",
      motion: "panic",
    });

    expect(tracker.current()).toBe("error");

    now = 2500;

    expect(tracker.current()).toBe("waiting");
  });

  it("tracks the latest AI placement safe zone for overlay positioning", () => {
    const tracker = createOverlayStateTracker({ eventUrl: null });

    tracker.sendEvent({
      type: "ai:decision",
      state: "coding",
      safeZone: "top-right",
    });

    expect(tracker.current()).toBe("coding");
    expect(tracker.placement()).toBe("top-right");
  });
});
