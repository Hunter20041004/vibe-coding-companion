import { describe, expect, it, vi } from "vitest";
import { createReadinessDiagnostic } from "../src/readiness-diagnostic.js";

describe("Readiness diagnostic", () => {
  it("checks hook configs, macOS accessibility signal, and prompt watcher service", async () => {
    const access = vi.fn(async (target) => {
      if (String(target).endsWith(".codex/hooks.json")) return;
      const error = new Error("missing");
      error.code = "ENOENT";
      throw error;
    });
    const readFile = vi.fn(async () =>
      JSON.stringify({
        services: [
          { id: "dev", pid: 4400 },
          { id: "prompt-watch", pid: 4402 },
        ],
      })
    );
    const killImpl = vi.fn(() => true);
    const detectForeground = vi.fn(async () => ({
      appName: "Codex",
      windowTitle: "Codex",
      accessibilityRegions: [{ role: "AXTextArea" }],
    }));

    const getReadinessDiagnostic = createReadinessDiagnostic({
      cwd: "/project",
      access,
      readFile,
      killImpl,
      detectForeground,
    });

    await expect(getReadinessDiagnostic()).resolves.toEqual({
      permissions: "ready",
      hooks: {
        codex: "ready",
        claudeCode: "missing",
      },
      promptWatcher: "ready",
    });
    expect(killImpl).toHaveBeenCalledWith(4402, 0);
  });
});
