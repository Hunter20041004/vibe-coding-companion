import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { appendHookCapture } from "../src/hook-capture.js";

const tempDirs = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    await fs.rm(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe("Hook capture", () => {
  it("appends hook payloads as JSON lines for later real-session analysis", async () => {
    const captureFile = path.join(await makeTempDir(), "hook-payloads.jsonl");
    const entry = {
      provider: "codex",
      payload: { event: "PreToolUse", tool: "Bash" },
      event: { type: "tool:start", tool: "test" },
    };

    await appendHookCapture(captureFile, entry);

    const lines = (await fs.readFile(captureFile, "utf8")).trim().split("\n");

    expect(lines.map((line) => JSON.parse(line))).toEqual([
      {
        captured_at: expect.any(String),
        provider: "codex",
        payload: { event: "PreToolUse", tool: "Bash" },
        event: { type: "tool:start", tool: "test" },
      },
    ]);
  });
});

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-hook-capture-"));
  tempDirs.push(dir);
  return dir;
}
