import { describe, expect, it } from "vitest";
import { getAnimationMood, getBlobFrame } from "../src/animation-model.js";

describe("Animation model", () => {
  it("maps vibe levels to panic, steady, and playful animation moods", () => {
    expect(getAnimationMood(12)).toBe("panic");
    expect(getAnimationMood(55)).toBe("steady");
    expect(getAnimationMood(88)).toBe("playful");
  });

  it("chooses readable blob poses from state and vibe", () => {
    expect(getBlobFrame({ state: "testing", vibe: 12 }).pose).toBe(
      "brace"
    );
    expect(getBlobFrame({ state: "success", vibe: 88 }).pose).toBe(
      "smug-dance"
    );
  });

  it("keeps user scale as the base for state animation scaling", () => {
    expect(
      getBlobFrame({ state: "success", vibe: 88, baseScale: 0.8 }).scale
    ).toBeCloseTo(0.96);
  });

  it("keeps animated movement near the user anchor", () => {
    const frame = getBlobFrame({
      state: "coding",
      vibe: 55,
      anchor: { x: 72, y: 64 },
      time: 250,
    });

    expect(Math.abs(frame.position.x - 72)).toBeLessThanOrEqual(18);
    expect(Math.abs(frame.position.y - 64)).toBeLessThanOrEqual(18);
  });

  it("gives every MVP state a distinct readable pose", () => {
    const poses = Object.fromEntries(
      [
        "idle",
        "thinking",
        "reading",
        "coding",
        "testing",
        "error",
        "debugging",
        "success",
        "waiting",
      ].map((state) => [state, getBlobFrame({ state, vibe: 55 }).pose])
    );

    expect(poses).toEqual({
      idle: "float",
      thinking: "spark-think",
      reading: "inspect",
      coding: "work-buddy",
      testing: "test-watch",
      error: "quick-startle",
      debugging: "magnify",
      success: "tiny-celebrate",
      waiting: "edge-peek",
    });
  });

  it("changes motion intensity by mode without changing the user base scale", () => {
    expect(
      getBlobFrame({ state: "coding", vibe: 55, mode: "calm" }).motion
        .amplitude
    ).toBe(0.55);
    expect(
      getBlobFrame({ state: "coding", vibe: 55, mode: "showcase" }).motion
        .amplitude
    ).toBe(1.45);
    expect(
      getBlobFrame({
        state: "success",
        vibe: 88,
        mode: "showcase",
        baseScale: 0.8,
      }).scale
    ).toBeCloseTo(0.96);
  });

  it("lets AI reaction intensity and motion shape the sprite frame", () => {
    const calmFrame = getBlobFrame({
      state: "debugging",
      vibe: 55,
      mode: "snark",
      reaction: { intensity: "low", motion: "observe" },
    });
    const panicFrame = getBlobFrame({
      state: "debugging",
      vibe: 55,
      mode: "snark",
      reaction: { intensity: "high", motion: "panic" },
    });

    expect(panicFrame.motion.amplitude).toBeGreaterThan(
      calmFrame.motion.amplitude
    );
    expect(panicFrame.pose).toBe("quick-startle");
    expect(panicFrame.scale).toBeGreaterThan(calmFrame.scale);
  });

  it("lets companion brain gestures override the readable pose", () => {
    expect(
      getBlobFrame({
        state: "debugging",
        vibe: 55,
        reaction: { gesture: "point", intensity: "high" },
      }).pose
    ).toBe("point");
  });

  it("cycles subtle idle poses while the companion is waiting", () => {
    const poses = [0, 2800, 5600, 8400].map(
      (time) => getBlobFrame({ state: "waiting", vibe: 55, time }).pose
    );

    expect(new Set(poses).size).toBeGreaterThan(1);
    expect(poses).toContain("edge-peek");
    expect(poses).toContain("idle-blink");
    expect(getBlobFrame({ state: "coding", vibe: 55, time: 5600 }).pose).toBe(
      "work-buddy"
    );
  });

  it("uses focus-safe companion intentions instead of constant sticker motion", () => {
    const waitingPoses = [0, 2800, 5600, 8400].map(
      (time) => getBlobFrame({ state: "waiting", vibe: 55, time }).pose
    );

    expect(waitingPoses.filter((pose) => pose === "edge-peek")).toHaveLength(3);
    expect(getBlobFrame({ state: "coding", vibe: 55 }).pose).toBe(
      "work-buddy"
    );
    expect(getBlobFrame({ state: "testing", vibe: 55 }).pose).toBe(
      "test-watch"
    );
    expect(getBlobFrame({ state: "error", vibe: 55 }).pose).toBe(
      "quick-startle"
    );
    expect(getBlobFrame({ state: "success", vibe: 55 }).pose).toBe(
      "tiny-celebrate"
    );
    expect(getBlobFrame({ state: "waiting", vibe: 55 }).motion.amplitude)
      .toBeLessThan(0.4);
  });
});
