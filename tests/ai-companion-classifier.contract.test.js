import { describe, expect, it } from "vitest";
import { AGENT_STATES } from "../src/agent-state.js";
import { createCompanionClassifierFromEnv } from "../src/ai-companion-classifier.js";

const runContract =
  process.env.RUN_AI_CONTRACT_TEST === "1" &&
  (process.env.AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.OPENAI_API_KEY);
const describeContract = runContract ? describe : describe.skip;

describeContract("AI companion classifier provider contract", () => {
  it("returns a valid structured companion decision from the real boundary", async () => {
    const classifyEvent = createCompanionClassifierFromEnv(process.env);

    const decision = await classifyEvent({
      event: { type: "tool:start", tool: "test" },
      recentEvents: [{ type: "tool:start", tool: "edit" }],
      fallbackState: "testing",
    });

    expect(AGENT_STATES).toContain(decision.state);
    expect(["low", "medium", "high"]).toContain(decision.intensity);
    expect(["observe", "wander", "work", "panic", "celebrate"]).toContain(
      decision.motion
    );
    expect(decision.line.length).toBeGreaterThan(0);
  });
});
