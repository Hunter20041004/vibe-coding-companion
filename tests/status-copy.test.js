import { describe, expect, it } from "vitest";
import { getStatusCopy } from "../src/status-copy.js";

describe("Status copy", () => {
  it("changes error copy by mode without blaming users or authors", () => {
    const calm = getStatusCopy("error", "calm");
    const snark = getStatusCopy("error", "snark");
    const showcase = getStatusCopy("error", "showcase");

    expect(calm).toBe("The test failed. Trying another angle.");
    expect(snark).toBe("The test is being dramatic.");
    expect(showcase).toBe("Impact detected. Re-routing the bug hunt.");
    expect(new Set([calm, snark, showcase]).size).toBe(3);
    expect(snark.toLowerCase()).not.toMatch(/you|user|author|who wrote/);
  });
});
