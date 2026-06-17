import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createLocalEventServer } from "../src/local-event-server.js";

const servers = [];

afterEach(async () => {
  while (servers.length > 0) {
    await servers.pop().close();
  }
});

describe("Hook config examples", () => {
  it("relays a Claude Code PostToolUse payload from stdin to the local endpoint", async () => {
    const config = JSON.parse(
      await fs.readFile("hooks/claude-code/settings.example.json", "utf8")
    );
    const command = config.hooks.PostToolUse[0].hooks[0].command;
    const server = createLocalEventServer();
    servers.push(server);
    await server.listen(0);

    const result = await runHookCommand(command, {
      EVENT_URL: `${server.url()}/events`,
      stdin: JSON.stringify({
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: { command: "npm test" },
        tool_response: { exit_code: 1 },
      }),
    });

    expect(result).toMatchObject({ code: 0 });

    const response = await fetch(`${server.url()}/events?since=0`);

    expect(await response.json()).toEqual({
      events: [
        {
          id: 1,
          event: {
            type: "tool:finish",
            tool: "test",
            status: "failed",
          },
        },
      ],
    });
  });

  it("relays a Codex PostToolUse payload from stdin to the local endpoint", async () => {
    const config = JSON.parse(
      await fs.readFile("hooks/codex/hooks.example.json", "utf8")
    );
    const command = config.hooks.PostToolUse[0].hooks[0].command;
    const server = createLocalEventServer();
    servers.push(server);
    await server.listen(0);

    const result = await runHookCommand(command, {
      EVENT_URL: `${server.url()}/events`,
      stdin: JSON.stringify({
        event: "PostToolUse",
        tool: "Bash",
        input: { command: "npm test" },
        result: { exitCode: 0 },
      }),
    });

    expect(result).toMatchObject({ code: 0 });

    const response = await fetch(`${server.url()}/events?since=0`);

    expect(await response.json()).toEqual({
      events: [
        {
          id: 1,
          event: {
            type: "tool:finish",
            tool: "test",
            status: "passed",
          },
        },
      ],
    });
  });

  it("allows Codex edit tools to trigger the live companion hook", async () => {
    const config = JSON.parse(
      await fs.readFile("hooks/codex/hooks.example.json", "utf8")
    );
    const matcher = new RegExp(config.hooks.PreToolUse[0].matcher);

    expect(["apply_patch", "Edit", "Write", "MultiEdit"].every((tool) =>
      matcher.test(tool)
    )).toBe(true);
  });

  it("captures raw hook payloads when HOOK_CAPTURE_FILE is configured", async () => {
    const config = JSON.parse(
      await fs.readFile("hooks/codex/hooks.example.json", "utf8")
    );
    const command = config.hooks.PreToolUse[0].hooks[0].command;
    const server = createLocalEventServer();
    servers.push(server);
    await server.listen(0);
    const captureFile = path.join(
      process.cwd(),
      `.tmp-hook-capture-${Date.now()}.jsonl`
    );

    try {
      const payload = {
        event: "PreToolUse",
        tool: "Bash",
        input: { command: "npm test" },
      };

      const result = await runHookCommand(command, {
        EVENT_URL: `${server.url()}/events`,
        HOOK_CAPTURE_FILE: captureFile,
        stdin: JSON.stringify(payload),
      });

      expect(result).toMatchObject({ code: 0 });

      const lines = (await fs.readFile(captureFile, "utf8")).trim().split("\n");

      expect(lines.map((line) => JSON.parse(line))).toEqual([
        {
          captured_at: expect.any(String),
          provider: "codex",
          payload,
          event: { type: "tool:start", tool: "test" },
        },
      ]);
    } finally {
      await fs.rm(captureFile, { force: true });
    }
  });

  it("prints valid Codex hook JSON output for Stop hooks", async () => {
    const config = JSON.parse(
      await fs.readFile("hooks/codex/hooks.example.json", "utf8")
    );
    const command = config.hooks.Stop[0].hooks[0].command;
    const server = createLocalEventServer();
    servers.push(server);
    await server.listen(0);

    const result = await runHookCommand(command, {
      EVENT_URL: `${server.url()}/events`,
      stdin: JSON.stringify({
        hook_event_name: "Stop",
        last_assistant_message: "done",
      }),
    });

    expect(result).toMatchObject({ code: 0 });
    expect(JSON.parse(result.stdout)).toEqual({ continue: true });
  });
});

function runHookCommand(command, { EVENT_URL, HOOK_CAPTURE_FILE, stdin }) {
  return new Promise((resolve) => {
    const child = spawn("sh", ["-lc", command], {
      cwd: process.cwd(),
      env: { ...process.env, EVENT_URL, HOOK_CAPTURE_FILE },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
    child.stdin.end(stdin);
  });
}
