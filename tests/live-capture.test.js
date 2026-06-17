import path from "node:path";
import { describe, expect, it } from "vitest";
import { createLiveCaptureLaunch } from "../src/live-capture.js";

describe("Live capture launcher", () => {
  it("builds a Codex launch command with hook capture enabled", () => {
    const projectRoot = "/tmp/vibe-project";

    expect(
      createLiveCaptureLaunch({
        provider: "codex",
        projectRoot,
        now: new Date("2026-06-10T14:30:00.000Z"),
        env: { PATH: "/usr/bin" },
      })
    ).toEqual({
      command: "codex",
      args: ["--no-alt-screen", "-C", projectRoot],
      captureFile: path.join(
        projectRoot,
        "artifacts/hook-payloads/codex-live-2026-06-10T14-30-00-000Z.jsonl"
      ),
      env: {
        PATH: "/usr/bin",
        EVENT_URL: "http://127.0.0.1:5174/events",
        HOOK_CAPTURE_FILE: path.join(
          projectRoot,
          "artifacts/hook-payloads/codex-live-2026-06-10T14-30-00-000Z.jsonl"
        ),
      },
    });
  });

  it("builds a Claude Code launch command with hook capture enabled", () => {
    const projectRoot = "/tmp/vibe-project";

    expect(
      createLiveCaptureLaunch({
        provider: "claude-code",
        projectRoot,
        now: new Date("2026-06-10T14:31:00.000Z"),
        env: { PATH: "/usr/bin", CLAUDE_BIN: "/usr/local/bin/claude" },
      })
    ).toEqual({
      command: "/usr/local/bin/claude",
      args: [],
      captureFile: path.join(
        projectRoot,
        "artifacts/hook-payloads/claude-code-live-2026-06-10T14-31-00-000Z.jsonl"
      ),
      env: {
        PATH: "/usr/bin",
        CLAUDE_BIN: "/usr/local/bin/claude",
        EVENT_URL: "http://127.0.0.1:5174/events",
        HOOK_CAPTURE_FILE: path.join(
          projectRoot,
          "artifacts/hook-payloads/claude-code-live-2026-06-10T14-31-00-000Z.jsonl"
        ),
      },
    });
  });
});
