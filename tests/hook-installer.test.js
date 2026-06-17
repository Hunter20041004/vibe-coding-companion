import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureHookConfig, installHookConfig } from "../src/hook-installer.js";

const tempDirs = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    await fs.rm(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe("Hook installer", () => {
  it("installs the Claude Code example into a project-local settings file", async () => {
    const projectRoot = await makeTempProject();

    await expect(
      installHookConfig({ provider: "claude-code", projectRoot })
    ).resolves.toEqual({
      destination: path.join(projectRoot, ".claude/settings.local.json"),
    });

    const installed = await fs.readFile(
      path.join(projectRoot, ".claude/settings.local.json"),
      "utf8"
    );
    const example = await fs.readFile(
      "hooks/claude-code/settings.example.json",
      "utf8"
    );

    expect(JSON.parse(installed)).toEqual(JSON.parse(example));
  });

  it("installs the Codex example into a project-local hooks file", async () => {
    const projectRoot = await makeTempProject();

    await expect(
      installHookConfig({ provider: "codex", projectRoot })
    ).resolves.toEqual({
      destination: path.join(projectRoot, ".codex/hooks.json"),
    });

    const installed = await fs.readFile(
      path.join(projectRoot, ".codex/hooks.json"),
      "utf8"
    );
    const example = await fs.readFile("hooks/codex/hooks.example.json", "utf8");

    expect(JSON.parse(installed)).toEqual(JSON.parse(example));
  });

  it("refuses to overwrite an existing hook config by default", async () => {
    const projectRoot = await makeTempProject();
    const existingPath = path.join(projectRoot, ".codex/hooks.json");
    await fs.mkdir(path.dirname(existingPath), { recursive: true });
    await fs.writeFile(existingPath, '{"hooks":{}}');

    await expect(
      installHookConfig({ provider: "codex", projectRoot })
    ).rejects.toThrow("Hook config already exists");

    await expect(fs.readFile(existingPath, "utf8")).resolves.toBe(
      '{"hooks":{}}'
    );
  });

  it("reuses an existing hook config when ensuring live capture setup", async () => {
    const projectRoot = await makeTempProject();
    const existingPath = path.join(projectRoot, ".codex/hooks.json");
    await fs.mkdir(path.dirname(existingPath), { recursive: true });
    await fs.writeFile(existingPath, '{"hooks":{}}');

    await expect(
      ensureHookConfig({ provider: "codex", projectRoot })
    ).resolves.toEqual({
      destination: existingPath,
      installed: false,
    });

    await expect(fs.readFile(existingPath, "utf8")).resolves.toBe(
      '{"hooks":{}}'
    );
  });

  it("installs a missing hook config when ensuring live capture setup", async () => {
    const projectRoot = await makeTempProject();

    await expect(
      ensureHookConfig({ provider: "codex", projectRoot })
    ).resolves.toEqual({
      destination: path.join(projectRoot, ".codex/hooks.json"),
      installed: true,
    });

    await expect(
      fs.readFile(path.join(projectRoot, ".codex/hooks.json"), "utf8")
    ).resolves.toContain('"hooks"');
  });
});

async function makeTempProject() {
  const projectRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "vibe-hook-install-")
  );
  tempDirs.push(projectRoot);
  return projectRoot;
}
