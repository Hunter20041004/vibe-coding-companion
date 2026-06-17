import { describe, expect, it } from "vitest";
import { eventFromAlias } from "../src/event-cli.js";

describe("Event CLI", () => {
  it("maps smoke aliases to observable event payloads", () => {
    expect(eventFromAlias("test-failed")).toEqual({
      type: "tool:finish",
      tool: "test",
      status: "failed",
    });
    expect(eventFromAlias("test-passed")).toEqual({
      type: "tool:finish",
      tool: "test",
      status: "passed",
    });
  });
});
