import { createOverlayBoundsInsideTarget } from "./overlay-window.js";

const DIRECT_AGENT_APPS = ["codex", "claude", "claude code"];
const HOST_APPS = [
  "terminal",
  "iterm2",
  "warp",
  "ghostty",
  "wezterm",
  "visual studio code",
  "code",
  "cursor",
  "windsurf",
];
const AGENT_TITLE_TERMS = ["codex", "claude", "claude code"];
const CONTENT_MODEL = {
  largeThreshold: 900,
  leftRailRatio: 0.2,
  leftRailMin: 220,
  leftRailMax: 360,
  rightPanelRatio: 0.24,
  rightPanelMin: 240,
  rightPanelMax: 360,
  topChrome: 72,
  composerHeightRatio: 0.18,
  composerMinHeight: 120,
  composerMaxHeight: 190,
  sidePanelTop: 72,
  sidePanelBottom: 70,
};

export function shouldShowOverlayForForeground({
  appName = "",
  windowTitle = "",
} = {}) {
  const app = normalize(appName);
  const title = normalize(windowTitle);

  if (DIRECT_AGENT_APPS.some((target) => app.includes(target))) {
    return true;
  }

  return (
    HOST_APPS.some((target) => app.includes(target)) &&
    AGENT_TITLE_TERMS.some((target) => title.includes(target))
  );
}

export function createOverlayPresenceController({
  overlayWindow,
  detectForeground,
  getOverlayState = () => "waiting",
  getOverlayPlacement = () => "right-edge",
  getOverlaySettings = () => ({}),
  getNow = () => Date.now(),
  intervalMs = 1000,
}) {
  let timer = 0;
  let visible = null;

  const checkOnce = async () => {
    if (!overlayWindow || overlayWindow.isDestroyed?.()) {
      return;
    }

    let foreground;

    try {
      foreground = await detectForeground();
    } catch {
      return;
    }

    const state = getOverlayState();
    const safeZone = getOverlayPlacement();
    const settings = getOverlaySettings();
    const timeMs = getNow();
    const placement = resolveOverlayPlacement({
      foreground,
      state,
      safeZone,
      timeMs,
      settings,
    });
    const shouldShow = placement.visible;

    if (shouldShow) {
      if (placement.chosenBounds && typeof overlayWindow.setBounds === "function") {
        overlayWindow.setBounds(placement.chosenBounds, true);
      }

      if (visible === shouldShow) {
        return;
      }

      visible = shouldShow;
      overlayWindow.show();
      return;
    }

    if (shouldShow === visible) {
      return;
    }

    visible = shouldShow;
    overlayWindow.hide();
  };

  return {
    checkOnce,
    start() {
      if (timer) {
        return;
      }

      timer = setInterval(() => {
        void checkOnce();
      }, intervalMs);
      void checkOnce();
    },
    stop() {
      if (!timer) {
        return;
      }

      clearInterval(timer);
      timer = 0;
    },
  };
}

export function shouldShowOverlayForState(state = "waiting") {
  return Boolean(String(state));
}

export function parseMacForegroundOutput(output) {
  const [appName = "", windowTitle = "", x, y, width, height, ...regionLines] =
    String(output).split("\n");
  const bounds = parseBounds({ x, y, width, height });
  const accessibilityRegions = parseAccessibilityRegions(regionLines, bounds);
  const foreground = { appName, windowTitle };

  if (bounds) {
    foreground.bounds = bounds;
  }

  if (accessibilityRegions.length) {
    foreground.accessibilityRegions = accessibilityRegions;
  }

  return foreground;
}

export function inferForegroundAvoidRegions({
  appName = "",
  windowTitle = "",
  bounds,
  accessibilityRegions = [],
} = {}) {
  if (!bounds || !shouldShowOverlayForForeground({ appName, windowTitle })) {
    return [];
  }

  const assistedRegions = normalizeAccessibilityAvoidRegions({
    accessibilityRegions,
    bounds,
  });
  const modeledRegions = inferModeledAvoidRegions(bounds);

  return [...modeledRegions, ...assistedRegions];
}

export function resolveOverlayPlacement({
  foreground = {},
  state = "waiting",
  safeZone = "right-edge",
  timeMs = 0,
  settings = {},
} = {}) {
  const visible = shouldShowOverlayForForeground(foreground);
  const accessibilityCount = foreground.accessibilityRegions?.length ?? 0;

  if (!visible) {
    return {
      visible: false,
      placementMode: "hidden-foreground",
      avoidRegionCount: 0,
      avoidRegions: [],
      chosenBounds: null,
    };
  }

  if (!foreground.bounds) {
    return {
      visible: true,
      placementMode: "bounds-unavailable",
      avoidRegionCount: 0,
      avoidRegions: [],
      chosenBounds: null,
    };
  }

  const avoidRegions = inferForegroundAvoidRegions(foreground);
  const chosenBounds = createOverlayBoundsInsideTarget({
    targetBounds: foreground.bounds,
    state,
    safeZone,
    timeMs,
    settings,
    avoidRegions,
  });

  return {
    visible: true,
    placementMode:
      accessibilityCount > 0 ? "accessibility-assisted" : "geometry-fallback",
    avoidRegionCount: avoidRegions.length,
    avoidRegions,
    chosenBounds,
  };
}

function inferModeledAvoidRegions(bounds) {
  if (bounds.width < CONTENT_MODEL.largeThreshold) {
    return [
      {
        role: "input",
        x: bounds.x,
        y: bounds.y + Math.round(bounds.height * 0.74),
        width: bounds.width,
        height: Math.round(bounds.height * 0.2),
      },
    ];
  }

  const leftRail = clamp(
    Math.round(bounds.width * CONTENT_MODEL.leftRailRatio),
    CONTENT_MODEL.leftRailMin,
    CONTENT_MODEL.leftRailMax
  );
  const rightPanel = clamp(
    Math.round(bounds.width * CONTENT_MODEL.rightPanelRatio),
    CONTENT_MODEL.rightPanelMin,
    CONTENT_MODEL.rightPanelMax
  );
  const composerHeight = clamp(
    Math.round(bounds.height * CONTENT_MODEL.composerHeightRatio),
    CONTENT_MODEL.composerMinHeight,
    CONTENT_MODEL.composerMaxHeight
  );
  const contentX = bounds.x + leftRail;
  const contentWidth = Math.max(0, bounds.width - leftRail - rightPanel);

  return [
    {
      role: "reading",
      x: contentX,
      y: bounds.y + CONTENT_MODEL.topChrome,
      width: contentWidth,
      height: Math.max(0, bounds.height - CONTENT_MODEL.topChrome - composerHeight),
    },
    {
      role: "input",
      x: contentX,
      y: bounds.y + bounds.height - composerHeight,
      width: contentWidth,
      height: composerHeight,
    },
    {
      role: "side-panel",
      x: bounds.x + bounds.width - rightPanel,
      y: bounds.y + CONTENT_MODEL.sidePanelTop,
      width: rightPanel,
      height: Math.max(
        0,
        bounds.height - CONTENT_MODEL.sidePanelTop - CONTENT_MODEL.sidePanelBottom
      ),
    },
  ];
}

function normalizeAccessibilityAvoidRegions({
  accessibilityRegions = [],
  bounds,
}) {
  return accessibilityRegions
    .map((region) => {
      const x = Number(region.x);
      const y = Number(region.y);
      const width = Number(region.width);
      const height = Number(region.height);
      const role = mapAccessibilityRole(region.sourceRole, {
        bounds,
        x,
        y,
        width,
        height,
      });

      if (!role) return null;
      if (
        [x, y, width, height].some((value) => !Number.isFinite(value)) ||
        width <= 0 ||
        height <= 0
      ) {
        return null;
      }

      return { role, x, y, width, height };
    })
    .filter(Boolean);
}

function mapAccessibilityRole(sourceRole, rect) {
  const role = String(sourceRole ?? "");
  if (role === "AXTextArea" || role === "AXTextField") return "input";
  if (role === "AXScrollArea" || role === "AXWebArea") return "reading";
  if (role === "AXGroup" && isRightSideRegion(rect)) return "side-panel";
  return "";
}

function isRightSideRegion({ bounds, x, width }) {
  if (!bounds || !Number.isFinite(x) || !Number.isFinite(width)) return false;
  return x + width / 2 >= bounds.x + bounds.width * 0.7;
}

function parseBounds({ x, y, width, height }) {
  const values = [x, y, width, height].map((value) => Number(value));

  if (values.some((value) => !Number.isFinite(value))) {
    return null;
  }

  return {
    x: values[0],
    y: values[1],
    width: values[2],
    height: values[3],
  };
}

function parseAccessibilityRegions(lines = [], bounds = null) {
  return lines
    .map((line) => {
      const [kind, sourceRole, x, y, width, height] = String(line).split("\t");
      if (kind !== "region") return null;
      const values = [x, y, width, height].map((value) => Number(value));
      if (values.some((value) => !Number.isFinite(value))) return null;
      if (values[2] <= 0 || values[3] <= 0) return null;
      if (
        sourceRole === "AXGroup" &&
        isNearFullWindowRegion(
          {
            x: values[0],
            y: values[1],
            width: values[2],
            height: values[3],
          },
          bounds
        )
      ) {
        return null;
      }

      return {
        sourceRole,
        x: values[0],
        y: values[1],
        width: values[2],
        height: values[3],
      };
    })
    .filter(Boolean);
}

function isNearFullWindowRegion(region, bounds) {
  if (!bounds) return false;
  const regionArea = region.width * region.height;
  const boundsArea = bounds.width * bounds.height;
  if (boundsArea <= 0) return false;

  return (
    regionArea >= boundsArea * 0.9 &&
    Math.abs(region.x - bounds.x) <= 4 &&
    Math.abs(region.y - bounds.y) <= 4
  );
}

function normalize(value) {
  return String(value).trim().toLowerCase();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
