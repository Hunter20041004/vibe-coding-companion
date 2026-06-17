export const DEFAULT_OVERLAY_SETTINGS = {
  idleSize: 64,
  activeScale: 1,
  wanderSpeed: 1,
  safeMargin: 24,
  preferredSide: "auto",
};

export function normalizeOverlaySettings(settings = {}) {
  return {
    idleSize: clampNumber(settings.idleSize, 48, 120, DEFAULT_OVERLAY_SETTINGS.idleSize),
    activeScale: clampNumber(
      settings.activeScale,
      0.75,
      1.35,
      DEFAULT_OVERLAY_SETTINGS.activeScale
    ),
    wanderSpeed: clampNumber(
      settings.wanderSpeed,
      0.5,
      2,
      DEFAULT_OVERLAY_SETTINGS.wanderSpeed
    ),
    safeMargin: clampNumber(
      settings.safeMargin,
      0,
      80,
      DEFAULT_OVERLAY_SETTINGS.safeMargin
    ),
    preferredSide: normalizePreferredSide(settings.preferredSide),
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizePreferredSide(value) {
  const side = String(value ?? "").trim();
  return ["auto", "left", "right"].includes(side)
    ? side
    : DEFAULT_OVERLAY_SETTINGS.preferredSide;
}
