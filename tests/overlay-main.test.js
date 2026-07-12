import { describe, expect, it, vi } from "vitest";
import {
  detectMacForegroundApp,
  launchOverlayWindow,
} from "../src/overlay-main-runtime.js";

describe("Overlay main runtime", () => {
  it("starts foreground presence detection after creating the overlay window", async () => {
    const overlayWindow = {
      setAlwaysOnTop: vi.fn(),
      setVisibleOnAllWorkspaces: vi.fn(),
      setIgnoreMouseEvents: vi.fn(),
      loadURL: vi.fn(),
    };
    const BrowserWindow = vi.fn(function BrowserWindowMock() {
      return overlayWindow;
    });
    const controller = { start: vi.fn() };
    const stateTracker = {
      start: vi.fn(),
      current: vi.fn(() => "idle"),
      placement: vi.fn(() => "right-edge"),
    };
    const settingsTracker = {
      start: vi.fn(),
      current: vi.fn(() => ({ idleSize: 92 })),
    };
    const createStateTracker = vi.fn(() => stateTracker);
    const createSettingsTracker = vi.fn(() => settingsTracker);
    const createPresenceController = vi.fn(() => controller);

    await launchOverlayWindow({
      BrowserWindow,
      screen: {
        getPrimaryDisplay: () => ({
          workArea: { x: 0, y: 0, width: 1440, height: 900 },
        }),
      },
      createPresenceController,
      createStateTracker,
      createSettingsTracker,
      env: { OVERLAY_URL: "http://127.0.0.1:5173/overlay.html" },
    });

    expect(BrowserWindow).toHaveBeenCalledOnce();
    expect(overlayWindow.loadURL).toHaveBeenCalledWith(
      "http://127.0.0.1:5173/overlay.html"
    );
    expect(overlayWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(true, {
      forward: true,
    });
    expect(stateTracker.start).toHaveBeenCalledOnce();
    expect(settingsTracker.start).toHaveBeenCalledOnce();
    expect(createPresenceController).toHaveBeenCalledWith(
      expect.objectContaining({
        getOverlayState: stateTracker.current,
        getOverlayPlacement: stateTracker.placement,
        getOverlaySettings: settingsTracker.current,
      })
    );
    expect(controller.start).toHaveBeenCalledOnce();
  });

  it("probes macOS foreground app with a timeout", async () => {
    const execFileImpl = vi.fn(async () => ({
      stdout:
        "Terminal\ncodex --no-alt-screen\n10\n20\n900\n700\n" +
        "region\tAXTextArea\t260\t620\t520\t90\n",
    }));

    await expect(
      detectMacForegroundApp({ execFileImpl, timeoutMs: 750 })
    ).resolves.toEqual({
      appName: "Terminal",
      windowTitle: "codex --no-alt-screen",
      bounds: { x: 10, y: 20, width: 900, height: 700 },
      accessibilityRegions: [
        { sourceRole: "AXTextArea", x: 260, y: 620, width: 520, height: 90 },
      ],
    });
    expect(execFileImpl).toHaveBeenCalledWith(
      "osascript",
      expect.any(Array),
      { timeout: 750 }
    );
    const [, args] = execFileImpl.mock.calls[0];
    expect(args.join("\n")).toContain("position of frontWindow");
    expect(args.join("\n")).toContain("size of frontWindow");
    expect(args.join("\n")).toContain("entire contents of frontWindow");
    expect(args.join("\n")).toContain("AXTextArea");
  });
});
