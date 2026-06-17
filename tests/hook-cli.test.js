import { describe, expect, it } from "vitest";
import { normalizeAndEmitHook } from "../src/hook-cli.js";

describe("Hook CLI", () => {
  it("normalizes a hook payload and posts the companion event to the local endpoint", async () => {
    const requests = [];
    const fetchImpl = async (url, options) => {
      requests.push({ url, options });

      return {
        ok: true,
        status: 202,
        json: async () => ({ accepted: true, id: 7 }),
      };
    };

    await expect(
      normalizeAndEmitHook({
        provider: "claude-code",
        payload: {
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          tool_input: { command: "npm test" },
        },
        eventUrl: "http://127.0.0.1:5174/events",
        fetchImpl,
      })
    ).resolves.toEqual({
      emitted: true,
      event: { type: "tool:start", tool: "test" },
      id: 7,
    });

    expect(requests).toEqual([
      {
        url: "http://127.0.0.1:5174/events",
        options: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "tool:start", tool: "test" }),
        },
      },
    ]);
  });

  it("does not post when the hook payload is not mapped to a companion event", async () => {
    const requests = [];
    const fetchImpl = async (url, options) => {
      requests.push({ url, options });
      throw new Error("fetch should not be called");
    };

    await expect(
      normalizeAndEmitHook({
        provider: "claude-code",
        payload: {
          hook_event_name: "PreToolUse",
          tool_name: "UnknownTool",
        },
        eventUrl: "http://127.0.0.1:5174/events",
        fetchImpl,
      })
    ).resolves.toEqual({ emitted: false, event: null, id: null });

    expect(requests).toEqual([]);
  });

  it("captures the raw hook payload before emitting the normalized event", async () => {
    const writes = [];
    const fetchImpl = async () => ({
      ok: true,
      status: 202,
      json: async () => ({ accepted: true, id: 8 }),
    });
    const payload = {
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: "npm test" },
      tool_response: { exit_code: 0 },
    };

    await expect(
      normalizeAndEmitHook({
        provider: "claude-code",
        payload,
        eventUrl: "http://127.0.0.1:5174/events",
        fetchImpl,
        capturePayload: async (entry) => writes.push(entry),
      })
    ).resolves.toEqual({
      emitted: true,
      event: { type: "tool:finish", tool: "test", status: "passed" },
      id: 8,
    });

    expect(writes).toEqual([
      {
        provider: "claude-code",
        payload,
        event: { type: "tool:finish", tool: "test", status: "passed" },
      },
    ]);
  });
});
