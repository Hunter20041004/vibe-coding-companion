import { describe, expect, it } from "vitest";
import {
  createOverlayBoundsInsideTarget,
  createOverlayWindowOptions,
  resolveOverlayUrl,
} from "../src/overlay-window.js";

describe("Overlay window", () => {
  it("creates a transparent always-on-top companion window near the lower right", () => {
    const options = createOverlayWindowOptions({
      workArea: { x: 0, y: 0, width: 1440, height: 900 },
    });

    expect(options).toMatchObject({
      width: 320,
      height: 420,
      minWidth: 64,
      minHeight: 64,
      frame: false,
      transparent: true,
      show: false,
      alwaysOnTop: true,
      resizable: true,
      focusable: false,
      skipTaskbar: true,
      hasShadow: false,
      backgroundColor: "#00000000",
    });
    expect(options.x).toBe(1088);
    expect(options.y).toBe(428);
    expect(options.webPreferences).toMatchObject({
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    });
  });

  it("loads the Vite overlay page by default and allows an override", () => {
    expect(resolveOverlayUrl({})).toBe("http://127.0.0.1:5173/overlay.html");
    expect(resolveOverlayUrl({ OVERLAY_URL: "http://example.test/overlay" }))
      .toBe("http://example.test/overlay");
  });

  it("allows the Electron window to shrink to the tiny waiting sprite", () => {
    const options = createOverlayWindowOptions({
      workArea: { x: 0, y: 0, width: 1440, height: 900 },
    });

    expect(options.minWidth).toBeLessThanOrEqual(76);
    expect(options.minHeight).toBeLessThanOrEqual(76);
  });

  it("keeps the waiting sprite in the main work area and away from the right sidebar", () => {
    const bounds = createOverlayBoundsInsideTarget({
      targetBounds: { x: 80, y: 44, width: 1040, height: 760 },
    });

    expect(bounds).toMatchObject({
      width: 76,
      height: 76,
    });
    expect(bounds.x).toBeGreaterThanOrEqual(380);
    expect(bounds.y).toBeGreaterThanOrEqual(136);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(846);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(614);
  });

  it("lets the waiting sprite wander across narrow Codex windows without panel reserve", () => {
    const bounds = createOverlayBoundsInsideTarget({
      targetBounds: { x: 40, y: 30, width: 520, height: 620 },
    });

    expect(bounds).toMatchObject({
      width: 72,
      height: 72,
    });
    expect(bounds.x).toBeGreaterThanOrEqual(64);
    expect(bounds.y).toBeGreaterThanOrEqual(102);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(536);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(510);
  });

  it("reserves the right-side Codex panel when parking a waiting sprite in a wide window", () => {
    const bounds = createOverlayBoundsInsideTarget({
      targetBounds: { x: -3, y: 44, width: 1470, height: 857 },
    });

    expect(bounds).toMatchObject({
      width: 76,
      height: 76,
    });
    expect(bounds.x).toBeGreaterThanOrEqual(350);
    expect(bounds.y).toBeGreaterThanOrEqual(136);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(1086);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(632);
  });

  it("moves the waiting sprite to a new edge-rail park after the attention interval", () => {
    const targetBounds = { x: -3, y: 44, width: 1470, height: 857 };
    const first = createOverlayBoundsInsideTarget({
      targetBounds,
      state: "waiting",
      timeMs: 0,
    });
    const second = createOverlayBoundsInsideTarget({
      targetBounds,
      state: "waiting",
      timeMs: 12000,
    });

    expect(second).not.toEqual(first);

    for (const bounds of [first, second]) {
      expect(bounds.width).toBe(76);
      expect(bounds.height).toBe(76);
      expect(bounds.x).toBeGreaterThanOrEqual(330);
      expect(bounds.y).toBeGreaterThanOrEqual(120);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(1110);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(700);
    }
  });

  it("parks waiting movement between brief edge-rail hops", () => {
    const targetBounds = { x: 80, y: 44, width: 1040, height: 760 };
    const parked = createOverlayBoundsInsideTarget({
      targetBounds,
      state: "waiting",
      timeMs: 0,
    });
    const stillParked = createOverlayBoundsInsideTarget({
      targetBounds,
      state: "waiting",
      timeMs: 6000,
    });
    const nextPark = createOverlayBoundsInsideTarget({
      targetBounds,
      state: "waiting",
      timeMs: 12000,
    });

    expect(stillParked).toEqual(parked);
    expect(nextPark).not.toEqual(parked);
  });

  it("keeps waiting wander on an edge rail instead of crossing the reading lane", () => {
    const targetBounds = { x: 80, y: 44, width: 1040, height: 760 };

    for (const timeMs of [0, 6000, 12000, 18000]) {
      const bounds = createOverlayBoundsInsideTarget({
        targetBounds,
        state: "waiting",
        timeMs,
      });
      const outsideCenter =
        bounds.x + bounds.width <= targetBounds.x + 260 ||
        bounds.x >= targetBounds.x + targetBounds.width - 360;

      expect(outsideCenter).toBe(true);
    }
  });

  it("docks near the coding rail while Codex is coding", () => {
    expect(
      createOverlayBoundsInsideTarget({
        targetBounds: { x: 80, y: 44, width: 1040, height: 760 },
        state: "coding",
      })
    ).toEqual({
      x: 960,
      y: 333,
      width: 132,
      height: 156,
    });
  });

  it("honors a left preferred side for active work placement", () => {
    expect(
      createOverlayBoundsInsideTarget({
        targetBounds: { x: 80, y: 44, width: 1040, height: 760 },
        state: "coding",
        settings: {
          preferredSide: "left",
          safeMargin: 24,
        },
      })
    ).toEqual({
      x: 108,
      y: 333,
      width: 132,
      height: 156,
    });
  });

  it("docks near the reading rail while Codex is scanning files", () => {
    expect(
      createOverlayBoundsInsideTarget({
        targetBounds: { x: 80, y: 44, width: 1040, height: 760 },
        state: "reading",
      })
    ).toEqual({
      x: 960,
      y: 181,
      width: 132,
      height: 156,
    });
  });

  it("docks near the lower output rail while Codex is testing", () => {
    expect(
      createOverlayBoundsInsideTarget({
        targetBounds: { x: 80, y: 44, width: 1040, height: 760 },
        state: "testing",
      })
    ).toEqual({
      x: 960,
      y: 515,
      width: 132,
      height: 156,
    });
  });

  it("docks near the top alert rail when Codex reports an error", () => {
    expect(
      createOverlayBoundsInsideTarget({
        targetBounds: { x: 80, y: 44, width: 1040, height: 760 },
        state: "error",
      })
    ).toEqual({
      x: 960,
      y: 112,
      width: 132,
      height: 156,
    });
  });

  it("docks near the celebration rail when Codex succeeds", () => {
    expect(
      createOverlayBoundsInsideTarget({
        targetBounds: { x: 80, y: 44, width: 1040, height: 760 },
        state: "success",
      })
    ).toEqual({
      x: 960,
      y: 363,
      width: 132,
      height: 156,
    });
  });

  it("keeps active reactions compact and outside the central reading lane", () => {
    const targetBounds = { x: 80, y: 44, width: 1040, height: 760 };

    for (const state of ["reading", "coding", "testing", "error", "success"]) {
      const bounds = createOverlayBoundsInsideTarget({ targetBounds, state });
      const outsideCenter =
        bounds.x + bounds.width <= targetBounds.x + 260 ||
        bounds.x >= targetBounds.x + targetBounds.width - 360;

      expect(bounds.width).toBeLessThanOrEqual(156);
      expect(bounds.height).toBeLessThanOrEqual(180);
      expect(outsideCenter).toBe(true);
      expect(bounds.y).toBeGreaterThanOrEqual(targetBounds.y + 56);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(
        targetBounds.y + targetBounds.height - 120
      );
    }
  });

  it("chooses a clear edge slot when active work would cover reading, input, or side-panel regions", () => {
    const avoidRegions = [
      { x: 260, y: 80, width: 660, height: 560, role: "reading" },
      { x: 260, y: 650, width: 660, height: 100, role: "input" },
      { x: 930, y: 80, width: 250, height: 640, role: "side-panel" },
    ];
    const bounds = createOverlayBoundsInsideTarget({
      targetBounds: { x: 0, y: 0, width: 1200, height: 800 },
      state: "coding",
      avoidRegions,
    });

    expect(bounds.width).toBeLessThanOrEqual(132);
    expect(bounds.height).toBeLessThanOrEqual(156);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(260);
    for (const region of avoidRegions) {
      expect(rectsOverlap(bounds, region)).toBe(false);
    }
  });

  it("shrinks active reactions into a quiet top-right retreat when no safe zone is clear", () => {
    expect(
      createOverlayBoundsInsideTarget({
        targetBounds: { x: 80, y: 44, width: 1040, height: 760 },
        state: "coding",
        safeZone: "retreat",
      })
    ).toEqual({
      x: 1028,
      y: 100,
      width: 64,
      height: 64,
    });
  });

  it("applies overlay calibration settings to idle and active bounds", () => {
    const targetBounds = { x: 80, y: 44, width: 1040, height: 760 };

    expect(
      createOverlayBoundsInsideTarget({
        targetBounds,
        state: "waiting",
        timeMs: 0,
        settings: {
          idleSize: 92,
          activeScale: 1,
          wanderSpeed: 1,
          safeMargin: 48,
        },
      })
    ).toMatchObject({
      width: 92,
      height: 92,
    });
    expect(
      createOverlayBoundsInsideTarget({
        targetBounds,
        state: "coding",
        settings: {
          idleSize: 76,
          activeScale: 1.2,
          wanderSpeed: 1,
          safeMargin: 24,
        },
      })
    ).toMatchObject({
      width: 152,
      height: 179,
    });

    const normalSpeed = createOverlayBoundsInsideTarget({
      targetBounds,
      state: "waiting",
      timeMs: 7000,
      settings: { wanderSpeed: 1 },
    });
    const fasterSpeed = createOverlayBoundsInsideTarget({
      targetBounds,
      state: "waiting",
      timeMs: 7000,
      settings: { wanderSpeed: 2 },
    });

    expect(fasterSpeed).not.toEqual(normalSpeed);
  });
});

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
