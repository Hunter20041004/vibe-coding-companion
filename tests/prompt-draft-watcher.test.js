import { describe, expect, it, vi } from "vitest";
import {
  createPromptDraftWatcher,
  detectMacPromptDraft,
  parseMacPromptDraftOutput,
} from "../src/prompt-draft-watcher.js";

describe("Prompt draft watcher", () => {
  it("parses focused macOS text area output including multiline drafts", () => {
    expect(
      parseMacPromptDraftOutput(
        [
          "Codex",
          "Codex",
          "AXTextArea",
          "fix the checkout bug",
          "run npm test after",
        ].join("\n")
      )
    ).toEqual({
      appName: "Codex",
      windowTitle: "Codex",
      focusedRole: "AXTextArea",
      prompt: "fix the checkout bug\nrun npm test after",
    });
  });

  it("emits a settled prompt draft only for agent text input windows", async () => {
    let now = 1000;
    const emitPromptDraft = vi.fn(async () => ({ accepted: true, id: 1 }));
    const readFocusedPrompt = vi
      .fn()
      .mockResolvedValueOnce({
        appName: "Safari",
        windowTitle: "Search",
        focusedRole: "AXTextField",
        prompt: "private search",
      })
      .mockResolvedValueOnce({
        appName: "Codex",
        windowTitle: "Codex",
        focusedRole: "AXTextArea",
        prompt: "fix failing checkout test",
      })
      .mockResolvedValueOnce({
        appName: "Codex",
        windowTitle: "Codex",
        focusedRole: "AXTextArea",
        prompt: "fix failing checkout test",
      });

    const watcher = createPromptDraftWatcher({
      readFocusedPrompt,
      emitPromptDraft,
      getNow: () => now,
      settleMs: 300,
      minChars: 12,
    });

    await watcher.checkOnce();
    await watcher.checkOnce();
    now = 1400;
    await watcher.checkOnce();

    expect(emitPromptDraft).toHaveBeenCalledTimes(1);
    expect(emitPromptDraft).toHaveBeenCalledWith({
      prompt: "fix failing checkout test",
      source: "accessibility",
    });
  });

  it("does not re-emit unchanged settled drafts", async () => {
    let now = 1000;
    const emitPromptDraft = vi.fn(async () => ({ accepted: true, id: 1 }));
    const readFocusedPrompt = vi.fn(async () => ({
      appName: "Codex",
      windowTitle: "Codex",
      focusedRole: "AXTextArea",
      prompt: "implement checkout UI and test it",
    }));
    const watcher = createPromptDraftWatcher({
      readFocusedPrompt,
      emitPromptDraft,
      getNow: () => now,
      settleMs: 200,
      minChars: 12,
    });

    await watcher.checkOnce();
    now = 1300;
    await watcher.checkOnce();
    now = 1800;
    await watcher.checkOnce();

    expect(emitPromptDraft).toHaveBeenCalledTimes(1);
  });

  it("does not read host terminal text areas that may include scrollback", async () => {
    let now = 1000;
    const emitPromptDraft = vi.fn(async () => ({ accepted: true, id: 1 }));
    const readFocusedPrompt = vi.fn(async () => ({
      appName: "Terminal",
      windowTitle: "codex --no-alt-screen",
      focusedRole: "AXTextArea",
      prompt: "fix failing checkout test",
    }));
    const watcher = createPromptDraftWatcher({
      readFocusedPrompt,
      emitPromptDraft,
      getNow: () => now,
      settleMs: 200,
      minChars: 12,
    });

    await watcher.checkOnce();
    now = 1300;
    await watcher.checkOnce();

    expect(emitPromptDraft).not.toHaveBeenCalled();
  });

  it("gates focused prompt reads behind direct Codex or Claude foreground apps", async () => {
    const execFileImpl = vi.fn(async () => ({
      stdout: "Safari\nSearch\n\n\n",
    }));

    await detectMacPromptDraft({ execFileImpl });

    const [, args] = execFileImpl.mock.calls[0];
    const script = args.join("\n");
    const gateIndex = script.indexOf("if shouldReadFocusedPrompt then");
    const focusedIndex = script.indexOf('AXFocusedUIElement');

    expect(script).toContain('appName contains "Codex"');
    expect(script).toContain('appName contains "Claude"');
    expect(gateIndex).toBeGreaterThan(-1);
    expect(focusedIndex).toBeGreaterThan(gateIndex);
  });
});
