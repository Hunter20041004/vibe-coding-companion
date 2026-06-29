export const DEFAULT_CHARACTER_ID = "cosmic-jellyfish";

export const BUILTIN_CHARACTER_IDS = [
  "cosmic-jellyfish",
  "foam-ghost",
  "green-phosphor-pixel",
];

const CHARACTER_PROFILES = [
  {
    id: "cosmic-jellyfish",
    name: "宇宙水母",
    tagline: "冷靜導航",
    coachingBias: "navigation",
    theme: {
      accent: "#8fd8ff",
      glow: "#8cffc8",
      bubble: "drift",
    },
    silhouette: "jellyfish",
    voice: {
      tone: "calm",
      prefix: "先定錨：",
    },
    overlay: {
      motion: "drift",
      bubbleShape: "soft-orbit",
    },
  },
  {
    id: "foam-ghost",
    name: "奶泡幽靈",
    tagline: "溫和陪伴",
    coachingBias: "gentle",
    theme: {
      accent: "#ffd6e8",
      glow: "#fff1c7",
      bubble: "foam",
    },
    silhouette: "foam",
    voice: {
      tone: "gentle",
      prefix: "慢慢來：",
    },
    overlay: {
      motion: "float",
      bubbleShape: "cream",
    },
  },
  {
    id: "green-phosphor-pixel",
    name: "綠磷光像素怪",
    tagline: "測試節奏",
    coachingBias: "testing",
    theme: {
      accent: "#9cff6a",
      glow: "#33ff99",
      bubble: "terminal",
    },
    silhouette: "pixel",
    voice: {
      tone: "terse",
      prefix: "跑指令：",
    },
    overlay: {
      motion: "tick",
      bubbleShape: "terminal",
    },
  },
];

export function listCharacterProfiles() {
  return CHARACTER_PROFILES.map((profile) => cloneProfile(profile));
}

export function getCharacterProfile(id) {
  return cloneProfile(
    CHARACTER_PROFILES.find((profile) => profile.id === id) ??
      CHARACTER_PROFILES[0]
  );
}

export function isBuiltInCharacterId(id) {
  return BUILTIN_CHARACTER_IDS.includes(String(id ?? ""));
}

export function normalizeCharacterId(id) {
  return isBuiltInCharacterId(id) ? String(id) : DEFAULT_CHARACTER_ID;
}

function cloneProfile(profile) {
  return {
    ...profile,
    theme: { ...profile.theme },
    voice: { ...profile.voice },
    overlay: { ...profile.overlay },
  };
}
