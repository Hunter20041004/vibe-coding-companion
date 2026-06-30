const DEFAULT_SIZE = {
  width: 320,
  height: 420,
  minWidth: 64,
  minHeight: 64,
};

const DEFAULT_MARGIN = {
  right: 32,
  bottom: 52,
};

const COMPANION_ZONE = {
  largeThreshold: 900,
  rightPanelReserveRatio: 0.24,
  rightPanelReserveMin: 240,
  rightPanelReserveMax: 360,
  right: 28,
  narrowRight: 24,
  top: 96,
  narrowTop: 72,
  width: 76,
  narrowWidth: 72,
  height: 76,
  narrowHeight: 72,
};

const IDLE_WANDER = {
  stepMs: 12000,
  contentLeftRatio: 0.24,
  contentLeftMin: 300,
  contentLeftMax: 420,
  rightPanelReserveRatio: 0.24,
  rightPanelReserveMin: 240,
  rightPanelReserveMax: 360,
  topOffset: 92,
  bottomReserveRatio: 0.26,
  bottomReserveMin: 190,
  bottomReserveMax: 280,
  narrowLeft: 24,
  narrowRight: 24,
  narrowTop: 72,
  narrowBottom: 140,
  points: [
    { x: 0.98, y: 0.04 },
    { x: 0.64, y: 0.18 },
    { x: 0.2, y: 0.46 },
    { x: 0.74, y: 0.74 },
    { x: 0.36, y: 0.28 },
  ],
};

const ACTIVE_RAIL = {
  largeThreshold: 900,
  width: 240,
  height: 220,
  narrowWidth: 220,
  narrowHeight: 204,
  right: 28,
  narrowRight: 18,
  topGuard: 56,
  bottomGuard: 120,
  yRatios: {
    reading: 0.18,
    coding: 0.38,
    testing: 0.62,
    error: 0.09,
    success: 0.42,
  },
};

const SAFE_ZONES = ["right-edge", "top-right", "bottom-right", "retreat"];

const ADAPTIVE_SIZE = {
  minWidth: 220,
  maxWidth: 320,
  widthRatio: 0.82,
  minHeight: 280,
  maxHeight: 420,
  heightRatio: 1.17,
};

const ACTIVE_RAIL_SIZE = {
  minWidth: 220,
  maxWidth: 240,
  widthRatio: 1,
  minHeight: 204,
  maxHeight: 220,
  heightRatio: 0.92,
};

const ACTIVE_STATES = new Set(["reading", "coding", "testing", "error", "success"]);

export function createOverlayWindowOptions({ workArea } = {}) {
  const bounds = workArea ?? { x: 0, y: 0, width: 1280, height: 800 };

  return {
    ...DEFAULT_SIZE,
    x: bounds.x + bounds.width - DEFAULT_SIZE.width - DEFAULT_MARGIN.right,
    y: bounds.y + bounds.height - DEFAULT_SIZE.height - DEFAULT_MARGIN.bottom,
    frame: false,
    transparent: true,
    show: false,
    alwaysOnTop: true,
    resizable: true,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  };
}

export function resolveOverlayUrl(env = process.env) {
  return env.OVERLAY_URL ?? "http://127.0.0.1:5173/overlay.html";
}

export function createOverlayBoundsInsideTarget({
  targetBounds,
  overlayBounds,
  margin = DEFAULT_MARGIN,
  state = "waiting",
  safeZone = "right-edge",
  timeMs = 0,
  settings = {},
  avoidRegions = [],
}) {
  const zone = createStateZone(targetBounds, state, timeMs, settings, safeZone);
  const sizing = getSizingForState(state);
  let width = overlayBounds?.width
    ? Math.min(overlayBounds.width, zone.width)
    : Math.min(
        zone.width,
        clamp(
          Math.round(zone.width * sizing.widthRatio),
          sizing.minWidth,
          sizing.maxWidth
        )
      );
  let height = overlayBounds?.height
    ? Math.min(overlayBounds.height, zone.height)
    : Math.min(
        zone.height,
        clamp(
          Math.round(width * sizing.heightRatio),
          sizing.minHeight,
          sizing.maxHeight
        )
      );
  const activeScale = getActiveScale(state, settings, safeZone);
  if (!overlayBounds && activeScale !== 1) {
    width = Math.min(targetBounds.width, Math.round(width * activeScale));
    height = Math.min(targetBounds.height, Math.round(height * activeScale));
  }
  const x = Math.round(zone.x + (zone.width - width) / 2);
  const y = Math.round(zone.y + (zone.height - height) / 2);

  return resolveClearBounds({
    preferredBounds: { x, y, width, height },
    targetBounds,
    state,
    settings,
    avoidRegions,
  });
}

function createStateZone(
  targetBounds,
  state,
  timeMs = 0,
  settings = {},
  safeZone = "right-edge"
) {
  if (isIdleWanderState(state)) {
    return createIdleWanderZone(targetBounds, timeMs, settings);
  }

  if (!ACTIVE_STATES.has(state)) {
    return createCompanionZone(targetBounds);
  }

  return createActiveRailZone(targetBounds, state, safeZone, settings);
}

function createActiveRailZone(
  targetBounds,
  state,
  safeZone = "right-edge",
  settings = {}
) {
  const placement = normalizeSafeZone(safeZone);
  const isLargeWindow = targetBounds.width >= ACTIVE_RAIL.largeThreshold;
  const isRetreat = placement === "retreat";
  const width = isRetreat
    ? DEFAULT_SIZE.minWidth
    : isLargeWindow
      ? ACTIVE_RAIL.width
      : ACTIVE_RAIL.narrowWidth;
  const height = isRetreat
    ? DEFAULT_SIZE.minHeight
    : isLargeWindow
      ? ACTIVE_RAIL.height
      : ACTIVE_RAIL.narrowHeight;
  const rightMargin = isLargeWindow ? ACTIVE_RAIL.right : ACTIVE_RAIL.narrowRight;
  const desiredX = getActiveRailX({
    targetBounds,
    width,
    rightMargin,
    settings,
    placement,
  });
  const yRatio = ACTIVE_RAIL.yRatios[state] ?? 0.24;
  const minY = targetBounds.y + ACTIVE_RAIL.topGuard;
  const maxY = targetBounds.y + targetBounds.height - ACTIVE_RAIL.bottomGuard - height;
  const desiredY = getActiveRailY({
    targetBounds,
    height,
    placement,
    yRatio,
    minY,
    maxY,
  });

  return {
    x: clamp(
      desiredX,
      targetBounds.x,
      targetBounds.x + Math.max(0, targetBounds.width - width)
    ),
    y: clamp(desiredY, minY, Math.max(minY, maxY)),
    width,
    height,
  };
}

function getActiveRailX({
  targetBounds,
  width,
  rightMargin,
  settings = {},
  placement,
}) {
  if (placement === "retreat") {
    return targetBounds.x + targetBounds.width - rightMargin - width;
  }

  if (getPreferredSide(settings) === "left") {
    return targetBounds.x + Math.max(rightMargin, getSafeMargin(settings));
  }

  return targetBounds.x + targetBounds.width - rightMargin - width;
}

function getActiveRailY({
  targetBounds,
  height,
  placement,
  yRatio,
  minY,
  maxY,
}) {
  if (placement === "top-right") return minY;
  if (placement === "bottom-right") return maxY;
  if (placement === "retreat") return minY;

  return targetBounds.y + Math.round(targetBounds.height * yRatio);
}

function isIdleWanderState(state) {
  return state === "idle" || state === "waiting";
}

function getSizingForState(state) {
  return ACTIVE_STATES.has(state) ? ACTIVE_RAIL_SIZE : ADAPTIVE_SIZE;
}

export function createCompanionZone(targetBounds) {
  const isLargeWindow = targetBounds.width >= COMPANION_ZONE.largeThreshold;
  const rightPanelReserve = isLargeWindow
    ? clamp(
        Math.round(targetBounds.width * COMPANION_ZONE.rightPanelReserveRatio),
        COMPANION_ZONE.rightPanelReserveMin,
        COMPANION_ZONE.rightPanelReserveMax
      )
    : 0;
  const rightMargin = isLargeWindow
    ? COMPANION_ZONE.right
    : COMPANION_ZONE.narrowRight;
  const topMargin = isLargeWindow ? COMPANION_ZONE.top : COMPANION_ZONE.narrowTop;
  const width = isLargeWindow
    ? COMPANION_ZONE.width
    : COMPANION_ZONE.narrowWidth;
  const height = isLargeWindow
    ? COMPANION_ZONE.height
    : COMPANION_ZONE.narrowHeight;
  const x = clamp(
    targetBounds.x +
      targetBounds.width -
      rightPanelReserve -
      width -
      rightMargin,
    targetBounds.x,
    targetBounds.x + Math.max(0, targetBounds.width - width)
  );
  const y = clamp(
    targetBounds.y + topMargin,
    targetBounds.y,
    targetBounds.y + Math.max(0, targetBounds.height - height)
  );

  return {
    x,
    y,
    width,
    height,
  };
}

function createIdleWanderZone(targetBounds, timeMs = 0, settings = {}) {
  const size = getCompanionSize(targetBounds, settings);
  const safeArea = createIdleSafeArea(targetBounds, size, settings);
  const point = getIdleWanderPoint(
    safeArea,
    timeMs * getWanderSpeed(settings)
  );

  return {
    x: point.x,
    y: point.y,
    width: size.width,
    height: size.height,
  };
}

function getCompanionSize(targetBounds, settings = {}) {
  const isLargeWindow = targetBounds.width >= COMPANION_ZONE.largeThreshold;
  const defaultSize = isLargeWindow
    ? COMPANION_ZONE.width
    : COMPANION_ZONE.narrowWidth;
  const configuredSize = getConfiguredIdleSize(settings);
  if (configuredSize) {
    const size = Math.max(configuredSize, defaultSize);
    return {
      width: size,
      height: size,
    };
  }

  return {
    width: defaultSize,
    height: isLargeWindow ? COMPANION_ZONE.height : COMPANION_ZONE.narrowHeight,
  };
}

function createIdleSafeArea(targetBounds, size, settings = {}) {
  const isLargeWindow = targetBounds.width >= COMPANION_ZONE.largeThreshold;
  const safeMargin = getSafeMargin(settings);

  if (!isLargeWindow) {
    const railX =
      targetBounds.x +
      targetBounds.width -
      IDLE_WANDER.narrowRight -
      safeMargin -
      size.width;
    const minY = targetBounds.y + IDLE_WANDER.narrowTop + safeMargin;
    const maxY =
      targetBounds.y +
      targetBounds.height -
      IDLE_WANDER.narrowBottom -
      safeMargin -
      size.height;

    return {
      minX: Math.max(targetBounds.x + safeMargin, railX),
      maxX: Math.max(targetBounds.x + safeMargin, railX),
      minY,
      maxY: Math.max(minY, maxY),
    };
  }

  const contentLeft = clamp(
    Math.round(targetBounds.width * IDLE_WANDER.contentLeftRatio),
    IDLE_WANDER.contentLeftMin,
    IDLE_WANDER.contentLeftMax
  );
  const rightPanelReserve = clamp(
    Math.round(targetBounds.width * IDLE_WANDER.rightPanelReserveRatio),
    IDLE_WANDER.rightPanelReserveMin,
    IDLE_WANDER.rightPanelReserveMax
  );
  const bottomReserve = clamp(
    Math.round(targetBounds.height * IDLE_WANDER.bottomReserveRatio),
    IDLE_WANDER.bottomReserveMin,
    IDLE_WANDER.bottomReserveMax
  );
  const railX =
    targetBounds.x +
    targetBounds.width -
    rightPanelReserve -
    COMPANION_ZONE.right -
    safeMargin -
    size.width;
  const minY =
    targetBounds.y +
    Math.min(IDLE_WANDER.topOffset + safeMargin, targetBounds.height);
  const maxY =
    targetBounds.y + targetBounds.height - bottomReserve - safeMargin - size.height;

  return {
    minX: Math.max(
      targetBounds.x + Math.min(contentLeft + safeMargin, targetBounds.width),
      railX
    ),
    maxX: Math.max(
      targetBounds.x + Math.min(contentLeft + safeMargin, targetBounds.width),
      railX
    ),
    minY,
    maxY: Math.max(minY, maxY),
  };
}

function getIdleWanderPoint(safeArea, timeMs) {
  const points = IDLE_WANDER.points;
  const step = Math.max(0, Math.floor(timeMs / IDLE_WANDER.stepMs));
  const current = points[step % points.length];

  return {
    x: Math.round(toX(safeArea, current)),
    y: Math.round(toY(safeArea, current)),
  };
}

function toX(safeArea, point) {
  return lerp(safeArea.minX, safeArea.maxX, point.x);
}

function toY(safeArea, point) {
  return lerp(safeArea.minY, safeArea.maxY, point.y);
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function getConfiguredIdleSize(settings = {}) {
  const idleSize = Number(settings.idleSize);
  if (!Number.isFinite(idleSize)) return null;
  return Math.round(clamp(idleSize, 48, 120));
}

function getActiveScale(state, settings = {}, safeZone = "right-edge") {
  if (isIdleWanderState(state)) return 1;
  if (normalizeSafeZone(safeZone) === "retreat") return 1;
  const activeScale = Number(settings.activeScale);
  if (!Number.isFinite(activeScale)) return 1;
  return clamp(activeScale, 0.75, 1.15);
}

function normalizeSafeZone(safeZone) {
  const value = String(safeZone ?? "").trim();
  return SAFE_ZONES.includes(value) ? value : "right-edge";
}

function getWanderSpeed(settings = {}) {
  const wanderSpeed = Number(settings.wanderSpeed);
  if (!Number.isFinite(wanderSpeed)) return 1;
  return clamp(wanderSpeed, 0.5, 2);
}

function getSafeMargin(settings = {}) {
  const safeMargin = Number(settings.safeMargin);
  if (!Number.isFinite(safeMargin)) return 0;
  return clamp(safeMargin, 0, 80);
}

function getPreferredSide(settings = {}) {
  const side = String(settings.preferredSide ?? "").trim();
  return ["auto", "left", "right"].includes(side) ? side : "auto";
}

function resolveClearBounds({
  preferredBounds,
  targetBounds,
  state,
  settings = {},
  avoidRegions = [],
}) {
  const normalizedRegions = normalizeAvoidRegions(avoidRegions);
  if (!normalizedRegions.length || !ACTIVE_STATES.has(state)) {
    return preferredBounds;
  }

  const preferredOverlap = totalOverlapArea(preferredBounds, normalizedRegions);
  if (preferredOverlap === 0) {
    return preferredBounds;
  }

  const candidates = createBoundsCandidates({
    preferredBounds,
    targetBounds,
    state,
    settings,
  });
  const [best] = candidates
    .map((bounds) => ({
      bounds,
      overlap: totalOverlapArea(bounds, normalizedRegions),
      distance: distanceBetweenCenters(bounds, preferredBounds),
    }))
    .sort((a, b) => a.overlap - b.overlap || a.distance - b.distance);

  return best?.bounds ?? preferredBounds;
}

function createBoundsCandidates({
  preferredBounds,
  targetBounds,
  state,
  settings = {},
}) {
  const yRatio = ACTIVE_RAIL.yRatios[state] ?? 0.24;
  const margin = getSafeMargin(settings);
  const sizes = createCandidateSizes(preferredBounds);
  const seen = new Set();
  const candidates = [];

  for (const { width, height } of sizes) {
    const minX = targetBounds.x + margin;
    const maxX = targetBounds.x + targetBounds.width - margin - width;
    const minY = targetBounds.y + ACTIVE_RAIL.topGuard;
    const maxY =
      targetBounds.y + targetBounds.height - ACTIVE_RAIL.bottomGuard - height;
    const clampedMaxX = Math.max(minX, maxX);
    const clampedMaxY = Math.max(minY, maxY);
    const activeY = clamp(
      targetBounds.y + Math.round(targetBounds.height * yRatio),
      minY,
      clampedMaxY
    );
    const centerY = clamp(
      targetBounds.y + Math.round((targetBounds.height - height) / 2),
      minY,
      clampedMaxY
    );
    const xPositions = [
      preferredBounds.x,
      minX,
      clampedMaxX,
      targetBounds.x + Math.round((targetBounds.width - width) / 2),
    ].map((x) => clamp(Math.round(x), minX, clampedMaxX));
    const yPositions = [
      preferredBounds.y,
      activeY,
      minY,
      centerY,
      clampedMaxY,
    ].map((y) => clamp(Math.round(y), minY, clampedMaxY));

    for (const x of xPositions) {
      for (const y of yPositions) {
        const key = `${x}:${y}:${width}:${height}`;
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push({ x, y, width, height });
      }
    }
  }

  return candidates;
}

function createCandidateSizes(preferredBounds) {
  const sizes = [
    {
      width: preferredBounds.width,
      height: preferredBounds.height,
    },
  ];

  if (preferredBounds.width > ACTIVE_RAIL_SIZE.minWidth) {
    sizes.push({
      width: ACTIVE_RAIL_SIZE.minWidth,
      height: Math.min(preferredBounds.height, ACTIVE_RAIL_SIZE.minHeight),
    });
  }

  return sizes;
}

function normalizeAvoidRegions(avoidRegions = []) {
  return avoidRegions
    .map((region) => ({
      x: Number(region.x),
      y: Number(region.y),
      width: Number(region.width),
      height: Number(region.height),
    }))
    .filter(
      (region) =>
        Number.isFinite(region.x) &&
        Number.isFinite(region.y) &&
        Number.isFinite(region.width) &&
        Number.isFinite(region.height) &&
        region.width > 0 &&
        region.height > 0
    );
}

function totalOverlapArea(bounds, regions) {
  return regions.reduce(
    (total, region) => total + getOverlapArea(bounds, region),
    0
  );
}

function getOverlapArea(a, b) {
  const xOverlap = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  );
  const yOverlap = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  );

  return xOverlap * yOverlap;
}

function distanceBetweenCenters(a, b) {
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;

  return Math.hypot(ax - bx, ay - by);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
