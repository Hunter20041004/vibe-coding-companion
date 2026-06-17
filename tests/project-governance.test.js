import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Project governance docs", () => {
  it("documents the current product context and architecture decisions", async () => {
    const context = await fs.readFile("CONTEXT.md", "utf8");
    const runtimeAdr = await fs.readFile(
      "docs/adr/0001-local-companion-runtime.md",
      "utf8"
    );
    const testRuntimeAdr = await fs.readFile(
      "docs/adr/0002-isolated-test-runtime.md",
      "utf8"
    );
    const deepModulesAdr = await fs.readFile(
      "docs/adr/0003-deepen-runtime-modules.md",
      "utf8"
    );

    expect(context).toContain("Vibe Coding Companion");
    expect(context).toContain("Companion Console");
    expect(context).toContain("desktop overlay");
    expect(runtimeAdr).toContain("local companion runtime");
    expect(testRuntimeAdr).toContain("5183");
    expect(testRuntimeAdr).toContain("5184");
    expect(deepModulesAdr).toContain("companion work interpretation");
    expect(deepModulesAdr).toContain("placement policy");
  });

  it("keeps local runtime artifacts out of git and documents the verify gate", async () => {
    const gitignore = await fs.readFile(".gitignore", "utf8");
    const readme = await fs.readFile("README.md", "utf8");

    expect(gitignore).toContain("artifacts/");
    expect(gitignore).toContain("test-results/");
    expect(gitignore).toContain("playwright-report/");
    expect(gitignore).toContain(".env*");
    expect(gitignore).toContain(".claude/settings.local.json");
    expect(gitignore).toContain(".codex/hooks.json");
    expect(readme).toContain("npm run verify");
  });
});
