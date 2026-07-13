import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

describe("portfolio presentation", () => {
  it("explains human-in-the-loop recommendation gating", () => {
    const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
    expect(readme).toContain("Human-in-the-loop");
    expect(readme).toContain("Executive Summary");
    expect(readme).toContain("deterministic Skill recommendation");
    expect(readme).toContain(
      "High-confidence recommendations may speak through the overlay",
    );
    expect(readme).toContain(
      "lower-confidence recommendations remain visible in the Console",
    );
    expect(readme).not.toContain(
      "A recommendation is surfaced only when it clears the confidence threshold; otherwise the companion stays quiet.",
    );
  });

  it("protects the documented privacy boundary and complete MIT scope", () => {
    const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
    const license = fs.readFileSync(path.join(ROOT, "LICENSE"), "utf8");

    expect(readme).toContain("## 安全與隱私");
    expect(readme).toContain("### 本機服務的安全邊界");
    expect(readme).toContain("Event server 只監聽 loopback");
    expect(readme).toContain("事件流不保存原始 prompt");

    expect(license).toContain("MIT License");
    expect(license).toContain("Permission is hereby granted, free of charge");
    expect(license).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
    expect(license).toMatch(
      /IN NO EVENT SHALL THE\s+AUTHORS OR COPYRIGHT HOLDERS BE LIABLE/,
    );
    expect(license).toContain(
      "This license applies only to code in this repository authored by Hunter",
    );
    expect(license).toContain(
      "It does not grant rights to third-party assets or other",
    );
  });
});
