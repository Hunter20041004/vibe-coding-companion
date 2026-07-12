import { describe, expect, it } from "vitest";
import { normalizeHookPayload } from "../src/hook-normalizer.js";

describe("Hook normalizer", () => {
  it("maps a Claude Code prompt submit hook to a companion prompt event", () => {
    expect(
      normalizeHookPayload("claude-code", {
        hook_event_name: "UserPromptSubmit",
        prompt: "fix the failing login test",
      })
    ).toEqual({ type: "prompt:submitted" });
  });

  it("maps a Claude Code Bash test start hook to a companion test start event", () => {
    expect(
      normalizeHookPayload("claude-code", {
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "npm test" },
      })
    ).toEqual({ type: "tool:start", tool: "test" });
  });

  it("maps an npm run test command hook to a companion test start event", () => {
    expect(
      normalizeHookPayload("claude-code", {
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "npm run test:e2e" },
      })
    ).toEqual({ type: "tool:start", tool: "test" });
  });

  it("maps a Claude Code edit hook to a companion edit start event", () => {
    expect(
      normalizeHookPayload("claude-code", {
        hook_event_name: "PreToolUse",
        tool_name: "Edit",
        tool_input: { file_path: "src/app.js" },
      })
    ).toEqual({ type: "tool:start", tool: "edit" });
  });

  it("maps a Claude Code write hook to a companion edit start event", () => {
    expect(
      normalizeHookPayload("claude-code", {
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: { file_path: "src/new-file.js" },
      })
    ).toEqual({ type: "tool:start", tool: "edit" });
  });

  it("maps a Claude Code read hook to a companion read start event", () => {
    expect(
      normalizeHookPayload("claude-code", {
        hook_event_name: "PreToolUse",
        tool_name: "Read",
        tool_input: { file_path: "README.md" },
      })
    ).toEqual({ type: "tool:start", tool: "read" });
  });

  it("maps a Claude Code grep hook to a companion read start event", () => {
    expect(
      normalizeHookPayload("claude-code", {
        hook_event_name: "PreToolUse",
        tool_name: "Grep",
        tool_input: { pattern: "auth" },
      })
    ).toEqual({ type: "tool:start", tool: "read" });
  });

  it("maps a failed Claude Code Bash test finish hook to a companion test failure event", () => {
    expect(
      normalizeHookPayload("claude-code", {
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: { command: "npm test" },
        tool_response: { exit_code: 1 },
      })
    ).toEqual({ type: "tool:finish", tool: "test", status: "failed" });
  });

  it("maps a Claude Code test hook failure to a companion test failure event", () => {
    expect(
      normalizeHookPayload("claude-code", {
        hook_event_name: "PostToolUseFailure",
        tool_name: "Bash",
        tool_input: { command: "npm test" },
      })
    ).toEqual({ type: "tool:finish", tool: "test", status: "failed" });
  });

  it("maps a passed Claude Code Bash test finish hook to a companion test success event", () => {
    expect(
      normalizeHookPayload("claude-code", {
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: { command: "npm test" },
        tool_response: { exit_code: 0 },
      })
    ).toEqual({ type: "tool:finish", tool: "test", status: "passed" });
  });

  it("maps a Claude Code stop hook to a companion turn complete event", () => {
    expect(
      normalizeHookPayload("claude-code", {
        hook_event_name: "Stop",
      })
    ).toEqual({ type: "turn:complete" });
  });

  it("maps a Codex-like Bash test start hook to a companion test start event", () => {
    expect(
      normalizeHookPayload("codex", {
        event: "PreToolUse",
        tool: "Bash",
        input: { command: "npm test" },
      })
    ).toEqual({ type: "tool:start", tool: "test" });
  });

  it("maps a real Codex Bash read command hook to a companion read start event", () => {
    expect(
      normalizeHookPayload("codex", {
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "bash -lc 'cat package.json'" },
      })
    ).toEqual({ type: "tool:start", tool: "read" });
  });

  it("maps a Codex apply_patch hook to a companion edit start event", () => {
    expect(
      normalizeHookPayload("codex", {
        event: "PreToolUse",
        tool: "apply_patch",
        input: { patch: "*** Begin Patch" },
      })
    ).toEqual({ type: "tool:start", tool: "edit" });
  });

  it("maps a Codex-like passed test finish hook with camelCase exit code", () => {
    expect(
      normalizeHookPayload("codex", {
        event: "PostToolUse",
        tool: "Bash",
        input: { command: "npm test" },
        result: { exitCode: 0 },
      })
    ).toEqual({ type: "tool:finish", tool: "test", status: "passed" });
  });

  it("maps a real Codex test output string with all tests passed to a success event", () => {
    expect(
      normalizeHookPayload("codex", {
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: { command: "npm test" },
        tool_response: `
          RUN  v2.1.9 /Users/developer/projects/vibe-coding-companion

          ✓ tests/hook-normalizer.test.js (16 tests) 3ms
          ✓ tests/overlay-window.test.js (9 tests) 8ms

          Test Files  23 passed (23)
               Tests  85 passed (85)
        `,
      })
    ).toEqual({ type: "tool:finish", tool: "test", status: "passed" });
  });
});
