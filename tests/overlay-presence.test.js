import { describe, expect, it, vi } from "vitest";
import {
  createOverlayPresenceController,
  inferForegroundAvoidRegions,
  parseMacForegroundOutput,
  resolveOverlayPlacement,
  shouldShowOverlayForForeground,
  shouldShowOverlayForState,
} from "../src/overlay-presence.js";

describe("Overlay presence", () => {
  it("shows the sprite for Codex, Claude, or terminal windows running them", () => {
    expect(shouldShowOverlayForForeground({ appName: "Codex" })).toBe(true);
    expect(shouldShowOverlayForForeground({ appName: "Claude" })).toBe(true);
    expect(
      shouldShowOverlayForForeground({
        appName: "Terminal",
        windowTitle: "New project 2 - codex --no-alt-screen",
      })
    ).toBe(true);
    expect(
      shouldShowOverlayForForeground({
        appName: "iTerm2",
        windowTitle: "claude code ~/repo",
      })
    ).toBe(true);
  });

  it("hides the sprite for unrelated foreground apps", () => {
    expect(shouldShowOverlayForForeground({ appName: "Safari" })).toBe(false);
    expect(
      shouldShowOverlayForForeground({
        appName: "Terminal",
        windowTitle: "zsh - New project 2",
      })
    ).toBe(false);
    expect(
      shouldShowOverlayForForeground({
        appName: "Visual Studio Code",
        windowTitle: "README.md",
      })
    ).toBe(false);
  });

  it("allows state-aware rendering for every agent state", () => {
    expect(shouldShowOverlayForState("idle")).toBe(true);
    expect(shouldShowOverlayForState("waiting")).toBe(true);
    expect(shouldShowOverlayForState("thinking")).toBe(true);
    expect(shouldShowOverlayForState("coding")).toBe(true);
  });

  it("shows a minimized desktop overlay while Codex is waiting", async () => {
    const overlayWindow = {
      show: vi.fn(),
      hide: vi.fn(),
      setBounds: vi.fn(),
      isDestroyed: () => false,
    };
    const controller = createOverlayPresenceController({
      overlayWindow,
      getOverlayState: () => "waiting",
      getNow: () => 0,
      detectForeground: async () => ({
        appName: "Codex",
        windowTitle: "Codex",
        bounds: { x: 80, y: 44, width: 1040, height: 760 },
      }),
    });

    await controller.checkOnce();

    expect(overlayWindow.setBounds).toHaveBeenCalledWith(
      {
        x: 766,
        y: 152,
        width: 76,
        height: 76,
      },
      true
    );
    expect(overlayWindow.show).toHaveBeenCalledOnce();
    expect(overlayWindow.hide).not.toHaveBeenCalled();
  });

  it("asks Electron to animate bounds changes so wandering slides instead of jumping", async () => {
    const overlayWindow = {
      show: vi.fn(),
      hide: vi.fn(),
      setBounds: vi.fn(),
      isDestroyed: () => false,
    };
    const controller = createOverlayPresenceController({
      overlayWindow,
      getOverlayState: () => "waiting",
      getNow: () => 0,
      detectForeground: async () => ({
        appName: "Codex",
        windowTitle: "Codex",
        bounds: { x: -3, y: 44, width: 1470, height: 857 },
      }),
    });

    await controller.checkOnce();

    expect(overlayWindow.setBounds).toHaveBeenCalledWith(
      {
        x: 1010,
        y: 155,
        width: 76,
        height: 76,
      },
      true
    );
  });

  it("shows and hides the overlay window from foreground app changes", async () => {
    const overlayWindow = {
      show: vi.fn(),
      hide: vi.fn(),
      isDestroyed: () => false,
    };
    const foregrounds = [
      { appName: "Safari", windowTitle: "OpenAI Docs" },
      { appName: "Terminal", windowTitle: "codex --no-alt-screen" },
      { appName: "Finder", windowTitle: "Downloads" },
    ];
    const controller = createOverlayPresenceController({
      overlayWindow,
      getOverlayState: () => "thinking",
      detectForeground: async () => foregrounds.shift(),
    });

    await controller.checkOnce();
    await controller.checkOnce();
    await controller.checkOnce();

    expect(overlayWindow.hide).toHaveBeenCalledTimes(2);
    expect(overlayWindow.show).toHaveBeenCalledTimes(1);
  });

  it("keeps the overlay window inside the detected Codex window bounds", async () => {
    const overlayWindow = {
      show: vi.fn(),
      hide: vi.fn(),
      setBounds: vi.fn(),
      getBounds: () => ({ x: 0, y: 0, width: 320, height: 420 }),
      isDestroyed: () => false,
    };
    const controller = createOverlayPresenceController({
      overlayWindow,
      getOverlayState: () => "thinking",
      detectForeground: async () => ({
        appName: "Codex",
        windowTitle: "Codex",
        bounds: { x: 80, y: 44, width: 1040, height: 760 },
      }),
    });

    await controller.checkOnce();

    expect(overlayWindow.setBounds).toHaveBeenCalledWith(
      {
        x: 766,
        y: 140,
        width: 76,
        height: 76,
      },
      true
    );
    expect(overlayWindow.show).toHaveBeenCalledOnce();
  });

  it("positions active work states on a clear reader-safe edge rail", async () => {
    const overlayWindow = {
      show: vi.fn(),
      hide: vi.fn(),
      setBounds: vi.fn(),
      isDestroyed: () => false,
    };
    const controller = createOverlayPresenceController({
      overlayWindow,
      getOverlayState: () => "coding",
      detectForeground: async () => ({
        appName: "Codex",
        windowTitle: "Codex",
        bounds: { x: 80, y: 44, width: 1040, height: 760 },
      }),
    });

    await controller.checkOnce();

    expect(overlayWindow.setBounds).toHaveBeenCalledWith(
      {
        x: 92,
        y: 333,
        width: 132,
        height: 156,
      },
      true
    );
  });

  it("keeps AI vertical placement while avoiding occupied right-side regions", async () => {
    const overlayWindow = {
      show: vi.fn(),
      hide: vi.fn(),
      setBounds: vi.fn(),
      isDestroyed: () => false,
    };
    const controller = createOverlayPresenceController({
      overlayWindow,
      getOverlayState: () => "coding",
      getOverlayPlacement: () => "bottom-right",
      detectForeground: async () => ({
        appName: "Codex",
        windowTitle: "Codex",
        bounds: { x: 80, y: 44, width: 1040, height: 760 },
      }),
    });

    await controller.checkOnce();

    expect(overlayWindow.setBounds).toHaveBeenCalledWith(
      {
        x: 92,
        y: 528,
        width: 132,
        height: 156,
      },
      true
    );
  });

  it("avoids inferred Codex reading, input, and side-panel regions for active work", async () => {
    const overlayWindow = {
      show: vi.fn(),
      hide: vi.fn(),
      setBounds: vi.fn(),
      isDestroyed: () => false,
    };
    const controller = createOverlayPresenceController({
      overlayWindow,
      getOverlayState: () => "coding",
      detectForeground: async () => ({
        appName: "Codex",
        windowTitle: "Codex",
        bounds: { x: 0, y: 0, width: 1200, height: 800 },
      }),
    });

    await controller.checkOnce();

    const [bounds] = overlayWindow.setBounds.mock.calls[0];
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(240);
    expect(bounds.width).toBeLessThanOrEqual(132);
    expect(bounds.height).toBeLessThanOrEqual(156);
  });

  it("resolves visible foreground placement through one policy interface", () => {
    const placement = resolveOverlayPlacement({
      foreground: {
        appName: "Codex",
        windowTitle: "Codex",
        bounds: { x: 10, y: 20, width: 1280, height: 760 },
      },
      state: "coding",
      safeZone: "right-edge",
      timeMs: 0,
      settings: { safeMargin: 24 },
    });

    expect(placement).toMatchObject({
      visible: true,
      placementMode: "geometry-fallback",
      avoidRegionCount: 3,
      chosenBounds: {
        width: expect.any(Number),
        height: expect.any(Number),
      },
    });
    expect(placement.chosenBounds.x).toBeGreaterThanOrEqual(10);
    expect(placement.chosenBounds.x + placement.chosenBounds.width).toBeLessThanOrEqual(
      1290
    );
  });

  it("adds accessibility-reported regions to the no-fly placement model", () => {
    const regions = inferForegroundAvoidRegions({
      appName: "Codex",
      windowTitle: "Codex",
      bounds: { x: 0, y: 0, width: 1200, height: 800 },
      accessibilityRegions: [
        { sourceRole: "AXScrollArea", x: 250, y: 100, width: 620, height: 420 },
        { sourceRole: "AXTextArea", x: 250, y: 560, width: 620, height: 220 },
        { sourceRole: "AXGroup", x: 920, y: 90, width: 260, height: 650 },
      ],
    });

    expect(regions).toContainEqual({
      role: "reading",
      x: 250,
      y: 100,
      width: 620,
      height: 420,
    });
    expect(regions).toContainEqual({
      role: "input",
      x: 250,
      y: 560,
      width: 620,
      height: 220,
    });
    expect(regions).toContainEqual({
      role: "side-panel",
      x: 920,
      y: 90,
      width: 260,
      height: 650,
    });
  });

  it("keeps following the Codex window while it is already visible", async () => {
    const overlayWindow = {
      show: vi.fn(),
      hide: vi.fn(),
      setBounds: vi.fn(),
      getBounds: () => ({ x: 0, y: 0, width: 320, height: 420 }),
      isDestroyed: () => false,
    };
    const foregrounds = [
      {
        appName: "Codex",
        windowTitle: "Codex",
        bounds: { x: 80, y: 44, width: 1040, height: 760 },
      },
      {
        appName: "Codex",
        windowTitle: "Codex",
        bounds: { x: 120, y: 70, width: 900, height: 700 },
      },
    ];
    const controller = createOverlayPresenceController({
      overlayWindow,
      getOverlayState: () => "thinking",
      detectForeground: async () => foregrounds.shift(),
    });

    await controller.checkOnce();
    await controller.checkOnce();

    expect(overlayWindow.setBounds).toHaveBeenNthCalledWith(
      1,
      {
        x: 766,
        y: 140,
        width: 76,
        height: 76,
      },
      true
    );
    expect(overlayWindow.setBounds).toHaveBeenNthCalledWith(
      2,
      {
        x: 676,
        y: 166,
        width: 76,
        height: 76,
      },
      true
    );
  });

  it("keeps waiting parked before briefly hopping to the next edge point", async () => {
    const overlayWindow = {
      show: vi.fn(),
      hide: vi.fn(),
      setBounds: vi.fn(),
      isDestroyed: () => false,
    };
    const times = [0, 6000, 12000];
    const controller = createOverlayPresenceController({
      overlayWindow,
      getOverlayState: () => "waiting",
      getNow: () => times.shift(),
      detectForeground: async () => ({
        appName: "Codex",
        windowTitle: "Codex",
        bounds: { x: -3, y: 44, width: 1470, height: 857 },
      }),
    });

    await controller.checkOnce();
    await controller.checkOnce();
    await controller.checkOnce();

    const firstBounds = overlayWindow.setBounds.mock.calls[0][0];
    const secondBounds = overlayWindow.setBounds.mock.calls[1][0];
    const thirdBounds = overlayWindow.setBounds.mock.calls[2][0];

    expect(secondBounds).toEqual(firstBounds);
    expect(thirdBounds).not.toEqual(firstBounds);
  });

  it("passes overlay calibration settings into bounds calculation", async () => {
    const overlayWindow = {
      show: vi.fn(),
      hide: vi.fn(),
      setBounds: vi.fn(),
      isDestroyed: () => false,
    };
    const controller = createOverlayPresenceController({
      overlayWindow,
      getOverlayState: () => "waiting",
      getOverlaySettings: () => ({
        idleSize: 92,
        activeScale: 1,
        wanderSpeed: 1,
        safeMargin: 48,
      }),
      getNow: () => 0,
      detectForeground: async () => ({
        appName: "Codex",
        windowTitle: "Codex",
        bounds: { x: 80, y: 44, width: 1040, height: 760 },
      }),
    });

    await controller.checkOnce();

    expect(overlayWindow.setBounds).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 92,
        height: 92,
      }),
      true
    );
  });

  it("ignores temporary foreground detection failures", async () => {
    const overlayWindow = {
      show: vi.fn(),
      hide: vi.fn(),
      isDestroyed: () => false,
    };
    const controller = createOverlayPresenceController({
      overlayWindow,
      detectForeground: async () => {
        throw new Error("System Events permission denied");
      },
    });

    await expect(controller.checkOnce()).resolves.toBeUndefined();
    expect(overlayWindow.show).not.toHaveBeenCalled();
    expect(overlayWindow.hide).not.toHaveBeenCalled();
  });

  it("parses the macOS foreground app probe output", () => {
    expect(parseMacForegroundOutput("Terminal\ncodex --no-alt-screen\n"))
      .toEqual({
        appName: "Terminal",
        windowTitle: "codex --no-alt-screen",
      });
    expect(parseMacForegroundOutput("Claude\n\n")).toEqual({
      appName: "Claude",
      windowTitle: "",
    });
  });

  it("parses foreground window bounds when macOS reports them", () => {
    expect(
      parseMacForegroundOutput("Codex\nCodex\n80\n44\n1040\n760\n")
    ).toEqual({
      appName: "Codex",
      windowTitle: "Codex",
      bounds: { x: 80, y: 44, width: 1040, height: 760 },
    });
  });

  it("parses accessibility no-fly regions from the foreground probe output", () => {
    expect(
      parseMacForegroundOutput(
        [
          "Codex",
          "Codex",
          "0",
          "0",
          "1200",
          "800",
          "region\tAXScrollArea\t240\t72\t672\t584",
          "region\tAXTextArea\t240\t656\t672\t144",
          "region\tAXGroup\t912\t72\t288\t658",
          "",
        ].join("\n")
      )
    ).toEqual({
      appName: "Codex",
      windowTitle: "Codex",
      bounds: { x: 0, y: 0, width: 1200, height: 800 },
      accessibilityRegions: [
        { sourceRole: "AXScrollArea", x: 240, y: 72, width: 672, height: 584 },
        { sourceRole: "AXTextArea", x: 240, y: 656, width: 672, height: 144 },
        { sourceRole: "AXGroup", x: 912, y: 72, width: 288, height: 658 },
      ],
    });
  });

  it("drops full-window accessibility groups because they are not useful no-fly regions", () => {
    expect(
      parseMacForegroundOutput(
        [
          "Codex",
          "Codex",
          "15",
          "47",
          "1423",
          "807",
          "region\tAXGroup\t15\t47\t1423\t807",
          "region\tAXTextArea\t430\t710\t740\t90",
          "",
        ].join("\n")
      )
    ).toEqual({
      appName: "Codex",
      windowTitle: "Codex",
      bounds: { x: 15, y: 47, width: 1423, height: 807 },
      accessibilityRegions: [
        { sourceRole: "AXTextArea", x: 430, y: 710, width: 740, height: 90 },
      ],
    });
  });
});
