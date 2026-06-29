import { DEFAULT_CHARACTER_ID, normalizeCharacterId } from "./character-profiles.js";

const STORAGE_KEY = "vibe-coding-companion-preferences";
const DEFAULT_PREFERENCES = {
  anchor: { x: 50, y: 46 },
  scale: 1,
  mode: "calm",
  activeCharacterId: DEFAULT_CHARACTER_ID,
};

export function createPreferenceStore(storage) {
  return {
    save(preferences) {
      storage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    },
    load() {
      const raw = storage.getItem(STORAGE_KEY);

      if (!raw) {
        return createDefaultPreferences();
      }

      try {
        return normalizePreferences(JSON.parse(raw));
      } catch {
        return createDefaultPreferences();
      }
    },
  };
}

function normalizePreferences(preferences = {}) {
  return {
    ...preferences,
    activeCharacterId: normalizeCharacterId(preferences.activeCharacterId),
  };
}

function createDefaultPreferences() {
  return {
    ...DEFAULT_PREFERENCES,
    anchor: { ...DEFAULT_PREFERENCES.anchor },
  };
}
