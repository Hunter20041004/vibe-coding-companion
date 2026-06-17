import { describe, expect, it, vi } from "vitest";
import { createDemoFlow } from "../src/demo-flow.js";

describe("Bug-fix demo flow", () => {
  it("runs the bug-fix states and settles in waiting after success", () => {
    vi.useFakeTimers();
    const seenStates = [];
    const flow = createDemoFlow({
      stepMs: 100,
      onState: (state) => seenStates.push(state),
    });

    flow.start();
    vi.runAllTimers();

    expect(seenStates).toEqual([
      "thinking",
      "reading",
      "coding",
      "testing",
      "error",
      "debugging",
      "testing",
      "success",
      "waiting",
    ]);

    vi.useRealTimers();
  });
});
