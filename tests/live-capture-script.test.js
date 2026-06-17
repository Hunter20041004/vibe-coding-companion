import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const tempDirs = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    await fs.rm(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe("Live capture script", () => {
  it("prints a launch plan without starting an agent in dry-run mode", async () => {
    const projectRoot = await makeTempProject();

    const { stdout } = await execFileAsync(
      "node",
      ["scripts/live-capture.js", "codex", "--print"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          LIVE_CAPTURE_PROJECT_ROOT: projectRoot,
          CODEX_BIN: "/usr/local/bin/codex-test",
        },
      }
    );

    const plan = JSON.parse(stdout);

    expect(plan).toMatchObject({
      hookConfig: {
        destination: path.join(projectRoot, ".codex/hooks.json"),
        installed: true,
      },
      launch: {
        command: "/usr/local/bin/codex-test",
        args: ["--no-alt-screen", "-C", projectRoot],
        captureFile: expect.stringContaining(
          path.join(projectRoot, "artifacts/hook-payloads/codex-live-")
        ),
      },
    });
    expect(plan.launch.env).toEqual({
      EVENT_URL: "http://127.0.0.1:5174/events",
      HOOK_CAPTURE_FILE: plan.launch.captureFile,
    });
    await expect(
      fs.stat(path.join(projectRoot, "artifacts/hook-payloads"))
    ).resolves.toMatchObject({ isDirectory: expect.any(Function) });
  });
});

async function makeTempProject() {
  const projectRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "vibe-live-capture-")
  );
  tempDirs.push(projectRoot);
  return projectRoot;
}
