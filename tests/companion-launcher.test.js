import { describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createCompanionLaunchPlan,
  openSetupKeyPage,
  promptForGoogleAiStudioKey,
  startCompanionServices,
  stopCompanionServices,
  writeGoogleAiStudioEnv,
} from "../src/companion-launcher.js";

describe("Companion launcher", () => {
  it("plans detached companion services without spawning Terminal windows", () => {
    const plan = createCompanionLaunchPlan({
      cwd: "/project",
      env: {
        AI_PROVIDER: "google",
        GEMINI_API_KEY: "secret",
        AI_MODEL: "gemma-4-31b-it",
      },
    });

    expect(plan.services).toEqual([
      expect.objectContaining({
        id: "dev",
        command: "npm",
        args: ["run", "dev:all"],
        detached: true,
        stdoutPath: "/project/artifacts/companion-dev.log",
        stderrPath: "/project/artifacts/companion-dev.err.log",
      }),
      expect.objectContaining({
        id: "overlay",
        command: "npm",
        args: ["run", "overlay"],
        detached: true,
        stdoutPath: "/project/artifacts/companion-overlay.log",
        stderrPath: "/project/artifacts/companion-overlay.err.log",
      }),
    ]);
    expect(plan.services.map((service) => service.command)).not.toContain(
      "osascript"
    );
    expect(plan.services.map((service) => service.command)).not.toContain(
      "open"
    );
  });

  it("writes a private Google AI Studio env file outside the project", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "companion-env-"));
    const envPath = path.join(tempDir, ".vibe-coding-companion.env");

    await writeGoogleAiStudioEnv({
      envPath,
      apiKey: "new-google-key",
    });

    const content = await fs.readFile(envPath, "utf8");
    const stat = await fs.stat(envPath);

    expect(content).toContain("AI_PROVIDER=google");
    expect(content).toContain("GEMINI_API_KEY=new-google-key");
    expect(content).toContain("AI_MODEL=gemma-4-31b-it");
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it("starts detached services with env loaded from the private file", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "companion-start-"));
    const envPath = path.join(cwd, "home", ".vibe-coding-companion.env");
    await writeGoogleAiStudioEnv({ envPath, apiKey: "loaded-key" });

    const spawned = [];
    const childUnref = vi.fn();
    const spawnImpl = vi.fn((command, args, options) => {
      const pid = 4400 + spawned.length;
      spawned.push({ command, args, options, pid });
      return { pid, unref: childUnref };
    });

    const result = await startCompanionServices({
      cwd,
      envPath,
      spawnImpl,
      fetchImpl: vi.fn(async () => ({ ok: true })),
      openLogFile: vi.fn(() => 99),
      closeLogFile: vi.fn(),
    });

    expect(result.services).toEqual([
      { id: "dev", pid: 4400 },
      { id: "overlay", pid: 4401 },
    ]);
    expect(spawned).toHaveLength(2);
    expect(spawned[0].options).toMatchObject({
      cwd,
      detached: true,
      windowsHide: true,
    });
    expect(spawned[0].options.env).toMatchObject({
      AI_PROVIDER: "google",
      GEMINI_API_KEY: "loaded-key",
      AI_MODEL: "gemma-4-31b-it",
    });
    expect(childUnref).toHaveBeenCalledTimes(2);
    await expect(
      fs.readFile(path.join(cwd, "artifacts", "companion-services.json"), "utf8")
    ).resolves.toContain("\"overlay\"");
  });

  it("waits for the overlay entrypoint before launching the Electron overlay", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "companion-start-"));
    const envPath = path.join(cwd, "missing.env");
    const spawned = [];
    const readinessChecks = [];
    const spawnImpl = vi.fn((command, args, options) => {
      const pid = 4500 + spawned.length;
      spawned.push({ command, args, options, pid });
      return { pid, unref: vi.fn() };
    });
    const fetchImpl = vi.fn(async () => {
      readinessChecks.push(spawned.map((service) => service.args.join(" ")));
      return { ok: readinessChecks.length >= 2 };
    });

    await startCompanionServices({
      cwd,
      envPath,
      spawnImpl,
      fetchImpl,
      sleepImpl: vi.fn(async () => {}),
      openLogFile: vi.fn(() => 99),
      closeLogFile: vi.fn(),
    });

    expect(fetchImpl).toHaveBeenCalledWith("http://127.0.0.1:5173/overlay.html");
    expect(readinessChecks[0]).toEqual(["run dev:all"]);
    expect(readinessChecks.at(-1)).toEqual(["run dev:all"]);
    expect(spawned.map((service) => service.args.join(" "))).toEqual([
      "run dev:all",
      "run overlay",
    ]);
  });

  it("stops recorded detached service groups and removes the pid file", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "companion-stop-"));
    const artifactsDir = path.join(cwd, "artifacts");
    await fs.mkdir(artifactsDir, { recursive: true });
    await fs.writeFile(
      path.join(artifactsDir, "companion-services.json"),
      JSON.stringify({
        services: [
          { id: "dev", pid: 4400 },
          { id: "overlay", pid: 4401 },
        ],
      })
    );
    const killImpl = vi.fn();

    const result = await stopCompanionServices({ cwd, killImpl });

    expect(killImpl).toHaveBeenCalledWith(-4400, "SIGTERM");
    expect(killImpl).toHaveBeenCalledWith(-4401, "SIGTERM");
    expect(result.stopped).toEqual([
      { id: "dev", pid: 4400 },
      { id: "overlay", pid: 4401 },
    ]);
    await expect(
      fs.readFile(path.join(artifactsDir, "companion-services.json"), "utf8")
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("prompts for the Google AI Studio key with a hidden macOS dialog", async () => {
    const execFileImpl = vi.fn(async (command, args) => {
      expect(command).toBe("osascript");
      expect(args.join("\n")).toContain("with hidden answer");
      return {
        stdout: "button returned:Save, text returned:new-google-key\n",
      };
    });

    await expect(
      promptForGoogleAiStudioKey({ execFileImpl })
    ).resolves.toBe("new-google-key");
  });

  it("opens the local browser setup page for API key entry", async () => {
    const execFileImpl = vi.fn(async () => ({ stdout: "" }));

    await openSetupKeyPage({ execFileImpl });

    expect(execFileImpl).toHaveBeenCalledWith("open", [
      "http://127.0.0.1:5173/setup-key.html",
    ]);
  });
});
