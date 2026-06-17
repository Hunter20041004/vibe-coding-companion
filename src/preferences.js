const STORAGE_KEY = "vibe-coding-companion-preferences";
const DEFAULT_PREFERENCES = {
  anchor: { x: 50, y: 46 },
  scale: 1,
  mode: "calm",
};

export function createPreferenceStore(storage) {
  return {
    save(preferences) {
      storage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    },
    load() {
      const raw = storage.getItem(STORAGE_KEY);

      if (!raw) {
        return { ...DEFAULT_PREFERENCES };
      }

      try {
        return JSON.parse(raw);
      } catch {
        return { ...DEFAULT_PREFERENCES };
      }
    },
  };
}
