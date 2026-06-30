import { describe, expect, it } from "vitest";
import { createEventAdapter } from "../src/event-adapter.js";

describe("Companion event adapter", () => {
  it("maps observable agent events into companion states", () => {
    const states = [];
    const adapter = createEventAdapter((state) => states.push(state));

    adapter.sendEvent({ type: "prompt:submitted" });
    adapter.sendEvent({ type: "prompt:typing" });
    adapter.sendEvent({ type: "prompt:stuck" });
    adapter.sendEvent({ type: "tool:start", tool: "read" });
    adapter.sendEvent({ type: "tool:start", tool: "edit" });
    adapter.sendEvent({ type: "tool:start", tool: "test" });
    adapter.sendEvent({ type: "tool:finish", tool: "test", status: "failed" });
    adapter.sendEvent({ type: "tool:start", tool: "debug" });
    adapter.sendEvent({ type: "tool:finish", tool: "test", status: "passed" });
    adapter.sendEvent({ type: "turn:complete" });

    expect(states).toEqual([
      "thinking",
      "typing",
      "stuck",
      "reading",
      "coding",
      "testing",
      "error",
      "debugging",
      "success",
      "waiting",
    ]);
  });

  it("uses AI companion decisions as first-class state events", () => {
    const states = [];
    const adapter = createEventAdapter((state) => states.push(state));

    expect(
      adapter.sendEvent({
        type: "ai:decision",
        state: "debugging",
        intensity: "high",
      })
    ).toBe("debugging");

    expect(states).toEqual(["debugging"]);
  });
});
