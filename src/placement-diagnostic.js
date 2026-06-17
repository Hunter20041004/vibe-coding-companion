import {
  resolveOverlayPlacement,
} from "./overlay-presence.js";

const DEFAULT_SETTINGS = {
  idleSize: 64,
  activeScale: 1,
  wanderSpeed: 1,
  safeMargin: 24,
};

export function createPlacementDiagnostic({
  detectForeground,
  getOverlaySettings = () => DEFAULT_SETTINGS,
  getNow = () => Date.now(),
} = {}) {
  if (typeof detectForeground !== "function") {
    throw new Error("createPlacementDiagnostic requires detectForeground.");
  }

  return async ({
    state = "waiting",
    safeZone = "right-edge",
    settingsOverride = {},
  } = {}) => {
    let foreground;

    try {
      foreground = await detectForeground();
    } catch (error) {
      return {
        ok: false,
        state,
        safeZone,
        placementMode: "foreground-unavailable",
        error: error?.message ?? "foreground_unavailable",
      };
    }

    const settings = {
      ...(await getOverlaySettings()),
      ...settingsOverride,
    };
    const placement = resolveOverlayPlacement({
      foreground,
      state,
      safeZone,
      timeMs: getNow(),
      settings,
    });
    const foregroundSummary = summarizeForeground(foreground, placement.visible);
    const accessibilityCount = foreground.accessibilityRegions?.length ?? 0;

    if (!placement.visible) {
      return {
        ok: true,
        state,
        safeZone,
        placementMode: placement.placementMode,
        foreground: foregroundSummary,
        accessibility: getAccessibilitySummary(accessibilityCount),
        avoidRegionCount: placement.avoidRegionCount,
        avoidRegions: placement.avoidRegions,
        chosenBounds: placement.chosenBounds,
      };
    }

    if (!placement.chosenBounds) {
      return {
        ok: true,
        state,
        safeZone,
        placementMode: placement.placementMode,
        foreground: foregroundSummary,
        accessibility: getAccessibilitySummary(accessibilityCount),
        avoidRegionCount: placement.avoidRegionCount,
        avoidRegions: placement.avoidRegions,
        chosenBounds: placement.chosenBounds,
      };
    }

    return {
      ok: true,
      state,
      safeZone,
      placementMode: placement.placementMode,
      foreground: foregroundSummary,
      accessibility: getAccessibilitySummary(accessibilityCount),
      avoidRegionCount: placement.avoidRegionCount,
      avoidRegions: placement.avoidRegions.slice(0, 8),
      chosenBounds: placement.chosenBounds,
    };
  };
}

function summarizeForeground(foreground = {}, visible) {
  return {
    appName: String(foreground.appName ?? ""),
    windowTitle: String(foreground.windowTitle ?? ""),
    visible,
    ...(foreground.bounds ? { bounds: foreground.bounds } : {}),
  };
}

function getAccessibilitySummary(regionCount) {
  return {
    regionCount,
    status: regionCount > 0 ? "useful" : "empty",
  };
}
