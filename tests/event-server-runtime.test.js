import { describe, expect, it, vi } from "vitest";
import { createEventServerOptions } from "../src/event-server-runtime.js";

describe("Event server runtime", () => {
  it("updates runtime Google AI settings and classifies with the latest env", async () => {
    const processEnv = {};
    const writeGoogleAiStudioEnv = vi.fn(async () => {});
    const classifyEvent = vi.fn(async () => ({
      state: "thinking",
      intensity: "medium",
      motion: "float",
      line: "Reading the room.",
    }));
    const createClassifierFromEnv = vi.fn(() => classifyEvent);

    const options = createEventServerOptions({
      processEnv,
      writeGoogleAiStudioEnv,
      createClassifierFromEnv,
    });

    await options.saveGoogleAiStudioKey({
      apiKey: "new-google-key",
      model: "gemma-4-31b-it",
    });

    await expect(
      options.classifyEvent({
        event: { type: "prompt:submitted" },
        recentEvents: [],
        fallbackState: "thinking",
      })
    ).resolves.toEqual({
      state: "thinking",
      intensity: "medium",
      motion: "float",
      line: "Reading the room.",
    });
    expect(writeGoogleAiStudioEnv).toHaveBeenCalledWith({
      apiKey: "new-google-key",
      model: "gemma-4-31b-it",
    });
    expect(processEnv).toMatchObject({
      AI_PROVIDER: "google",
      GEMINI_API_KEY: "new-google-key",
      AI_MODEL: "gemma-4-31b-it",
    });
    expect(createClassifierFromEnv).toHaveBeenCalledWith(processEnv);
  });

  it("reports sanitized AI settings status from runtime env", () => {
    const options = createEventServerOptions({
      processEnv: {
        AI_PROVIDER: "google",
        GEMINI_API_KEY: "secret-key",
        AI_MODEL: "gemma-4-31b-it",
      },
    });

    expect(options.getSettingsStatus()).toEqual({
      aiConfigured: true,
      provider: "google",
      model: "gemma-4-31b-it",
    });
    expect(JSON.stringify(options.getSettingsStatus())).not.toContain(
      "secret-key"
    );
  });

  it("passes explicitly configured loopback browser origins to the server", () => {
    const options = createEventServerOptions({
      processEnv: {
        ALLOWED_BROWSER_ORIGINS:
          "http://127.0.0.1:5183,http://localhost:5183",
      },
    });

    expect(options.allowedOrigins).toEqual(
      new Set(["http://127.0.0.1:5183", "http://localhost:5183"])
    );
  });

  it("ignores configured browser origins that are not loopback", () => {
    const options = createEventServerOptions({
      processEnv: {
        ALLOWED_BROWSER_ORIGINS:
          "https://evil.example,http://127.0.0.1:5183",
      },
    });

    expect(options.allowedOrigins).toEqual(
      new Set(["http://127.0.0.1:5183"])
    );
  });

  it("exposes the installed Codex skill metadata loader", async () => {
    const loadInstalledSkills = vi.fn(async () => [
      {
        name: "diagnose",
        description: "Disciplined diagnosis loop.",
        path: "/skills/diagnose/SKILL.md",
      },
    ]);
    const options = createEventServerOptions({ loadInstalledSkills });

    await expect(options.loadInstalledSkills()).resolves.toEqual([
      {
        name: "diagnose",
        description: "Disciplined diagnosis loop.",
        path: "/skills/diagnose/SKILL.md",
      },
    ]);
    expect(loadInstalledSkills).toHaveBeenCalledOnce();
  });

  it("exposes overlay calibration readers and writers", async () => {
    const readOverlaySettings = vi.fn(async () => ({
      idleSize: 76,
      activeScale: 1,
      wanderSpeed: 1,
      safeMargin: 24,
    }));
    const writeOverlaySettings = vi.fn(async ({ settings }) => ({
      ...settings,
      idleSize: 90,
    }));
    const options = createEventServerOptions({
      readOverlaySettings,
      writeOverlaySettings,
    });

    await expect(options.getOverlaySettings()).resolves.toEqual({
      idleSize: 76,
      activeScale: 1,
      wanderSpeed: 1,
      safeMargin: 24,
    });
    await expect(
      options.saveOverlaySettings({
        idleSize: 88,
        activeScale: 1.1,
        wanderSpeed: 1.5,
        safeMargin: 30,
      })
    ).resolves.toEqual({
      idleSize: 90,
      activeScale: 1.1,
      wanderSpeed: 1.5,
      safeMargin: 30,
    });
  });

  it("creates a vision analyzer from runtime Google env", async () => {
    const analyze = vi.fn(async () => ({
      activity: "Reading a Codex diff.",
      suggestedState: "reading",
      confidence: 0.8,
      visibleSignals: ["diff"],
    }));
    const createVisionAnalyzerFromEnv = vi.fn(() => analyze);
    const processEnv = {
      AI_PROVIDER: "google",
      GEMINI_API_KEY: "google-key",
      AI_MODEL: "gemma-4-31b-it",
    };
    const options = createEventServerOptions({
      processEnv,
      createVisionAnalyzerFromEnv,
    });

    await expect(
      options.analyzeVisionContext({
        imageDataUrl: "data:image/png;base64,ZmFrZQ==",
      })
    ).resolves.toEqual({
      activity: "Reading a Codex diff.",
      suggestedState: "reading",
      confidence: 0.8,
      visibleSignals: ["diff"],
    });
    expect(createVisionAnalyzerFromEnv).toHaveBeenCalledWith(processEnv);
  });

  it("creates a placement diagnostic provider from runtime foreground detection", async () => {
    const detectForeground = vi.fn(async () => ({
      appName: "Codex",
      windowTitle: "Codex",
    }));
    const createPlacementDiagnostic = vi.fn(
      ({ detectForeground: detect, getOverlaySettings }) =>
        async ({ state, safeZone }) => ({
          ok: true,
          state,
          safeZone,
          foreground: await detect(),
          settings: await getOverlaySettings(),
        })
    );
    const readOverlaySettings = vi.fn(async () => ({
      idleSize: 64,
      activeScale: 1,
      wanderSpeed: 1,
      safeMargin: 24,
    }));
    const options = createEventServerOptions({
      detectForeground,
      createPlacementDiagnostic,
      readOverlaySettings,
    });

    await expect(
      options.getPlacementDiagnostic({
        state: "coding",
        safeZone: "right-edge",
      })
    ).resolves.toEqual({
      ok: true,
      state: "coding",
      safeZone: "right-edge",
      foreground: {
        appName: "Codex",
        windowTitle: "Codex",
      },
      settings: {
        idleSize: 64,
        activeScale: 1,
        wanderSpeed: 1,
        safeMargin: 24,
      },
    });
    expect(createPlacementDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        detectForeground,
        getOverlaySettings: expect.any(Function),
      })
    );
  });

  it("creates a readiness diagnostic provider from runtime probes", async () => {
    const getReadinessDiagnostic = vi.fn(async () => ({
      permissions: "ready",
      hooks: {
        codex: "ready",
        claudeCode: "missing",
      },
      promptWatcher: "ready",
    }));
    const createReadinessDiagnostic = vi.fn(() => getReadinessDiagnostic);
    const detectForeground = vi.fn(async () => ({
      appName: "Codex",
      accessibilityRegions: [{ role: "AXTextArea" }],
    }));

    const options = createEventServerOptions({
      cwd: "/project",
      detectForeground,
      createReadinessDiagnostic,
    });

    await expect(options.getReadinessDiagnostic()).resolves.toEqual({
      permissions: "ready",
      hooks: {
        codex: "ready",
        claudeCode: "missing",
      },
      promptWatcher: "ready",
    });
    expect(createReadinessDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: "/project",
        detectForeground,
      })
    );
  });
});
