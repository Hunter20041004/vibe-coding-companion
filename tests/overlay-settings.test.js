import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_OVERLAY_SETTINGS,
  normalizeOverlaySettings,
  readOverlaySettings,
  writeOverlaySettings,
} from "../src/overlay-settings.js";

describe("Overlay settings", () => {
  it("normalizes calibration values into safe ranges", () => {
    expect(
      normalizeOverlaySettings({
        idleSize: 999,
        activeScale: 0.1,
        wanderSpeed: 8,
        safeMargin: -20,
        preferredSide: "diagonal",
      })
    ).toEqual({
      idleSize: 120,
      activeScale: 0.75,
      wanderSpeed: 2,
      safeMargin: 0,
      preferredSide: "auto",
    });
  });

  it("reads defaults when the local overlay settings file does not exist", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "overlay-settings-"));
    const settingsPath = path.join(tempDir, "missing.json");

    await expect(readOverlaySettings({ settingsPath })).resolves.toEqual(
      DEFAULT_OVERLAY_SETTINGS
    );
  });

  it("writes private local overlay settings outside the repo", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "overlay-settings-"));
    const settingsPath = path.join(tempDir, "overlay.json");

    await writeOverlaySettings({
      settingsPath,
      settings: {
        idleSize: 90,
        activeScale: 1.2,
        wanderSpeed: 1.5,
        safeMargin: 32,
        preferredSide: "left",
      },
    });

    expect(await readOverlaySettings({ settingsPath })).toEqual({
      idleSize: 90,
      activeScale: 1.2,
      wanderSpeed: 1.5,
      safeMargin: 32,
      preferredSide: "left",
    });
    expect((await fs.stat(settingsPath)).mode & 0o777).toBe(0o600);
  });
});
