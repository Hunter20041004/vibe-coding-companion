import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

describe("portfolio presentation", () => {
  it("explains human-in-the-loop value and license scope", () => {
    const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
    const license = fs.readFileSync(path.join(ROOT, "LICENSE"), "utf8");
    expect(readme).toContain("Human-in-the-loop");
    expect(readme).toContain("Executive Summary");
    expect(readme).toContain("deterministic Skill recommendation");
    expect(license).toContain("MIT License");
  });
});
