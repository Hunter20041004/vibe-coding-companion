import { describe, expect, it } from "vitest";
import { createPlacementDiagnostic } from "../src/placement-diagnostic.js";

describe("Placement diagnostic", () => {
  it("summarizes foreground, no-fly regions, chosen bounds, and placement reason", async () => {
    const diagnostic = createPlacementDiagnostic({
      detectForeground: async () => ({
        appName: "Codex",
        windowTitle: "Codex",
        bounds: { x: 0, y: 0, width: 1200, height: 800 },
        accessibilityRegions: [
          { sourceRole: "AXTextArea", x: 250, y: 560, width: 620, height: 220 },
        ],
      }),
      getOverlaySettings: () => ({
        idleSize: 64,
        activeScale: 1,
        wanderSpeed: 1,
        safeMargin: 24,
      }),
      getNow: () => 0,
    });

    await expect(
      diagnostic({ state: "coding", safeZone: "right-edge" })
    ).resolves.toMatchObject({
      ok: true,
      state: "coding",
      safeZone: "right-edge",
      placementMode: "accessibility-assisted",
      foreground: {
        appName: "Codex",
        windowTitle: "Codex",
        visible: true,
        bounds: { x: 0, y: 0, width: 1200, height: 800 },
      },
      accessibility: {
        regionCount: 1,
        status: "useful",
      },
      avoidRegionCount: 4,
      chosenBounds: {
        x: 24,
        y: 304,
        width: 132,
        height: 156,
      },
    });
  });

  it("previews a preferred side override without changing saved settings", async () => {
    const diagnostic = createPlacementDiagnostic({
      detectForeground: async () => ({
        appName: "Codex",
        windowTitle: "Codex",
        bounds: { x: 80, y: 44, width: 820, height: 760 },
      }),
      getOverlaySettings: () => ({
        idleSize: 64,
        activeScale: 1,
        wanderSpeed: 1,
        safeMargin: 24,
        preferredSide: "right",
      }),
      getNow: () => 0,
    });

    await expect(
      diagnostic({
        state: "coding",
        safeZone: "right-edge",
        settingsOverride: { preferredSide: "left" },
      })
    ).resolves.toMatchObject({
      chosenBounds: {
        x: 104,
        y: 333,
        width: 112,
        height: 132,
      },
    });
  });
});
