import { describe, expect, it } from "vitest";
import { AGENT_STATES, createAgentState } from "../src/agent-state.js";

describe("Agent state model", () => {
  it("starts at idle and accepts the nine MVP states", () => {
    const agent = createAgentState();

    expect(agent.current()).toBe("idle");
    expect(AGENT_STATES).toEqual([
      "idle",
      "thinking",
      "reading",
      "coding",
      "testing",
      "error",
      "debugging",
      "success",
      "waiting",
    ]);

    for (const state of AGENT_STATES) {
      agent.set(state);
      expect(agent.current()).toBe(state);
    }
  });
});
