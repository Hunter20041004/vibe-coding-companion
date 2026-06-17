import {
  DEFAULT_OVERLAY_SETTINGS,
  normalizeOverlaySettings,
} from "./overlay-settings-values.js";

export function createOverlaySettingsTracker({
  settingsUrl = "http://127.0.0.1:5174/settings/overlay",
  fetchImpl = globalThis.fetch,
  intervalMs = 3000,
} = {}) {
  let timer = 0;
  let settings = { ...DEFAULT_OVERLAY_SETTINGS };

  const pollOnce = async () => {
    if (!settingsUrl || typeof fetchImpl !== "function") return settings;

    try {
      const response = await fetchImpl(settingsUrl);
      if (!response.ok) return settings;
      const payload = await response.json();
      if (payload.settings) {
        settings = normalizeOverlaySettings(payload.settings);
      }
    } catch {
      return settings;
    }

    return settings;
  };

  return {
    current() {
      return settings;
    },
    pollOnce,
    start() {
      if (timer) return;
      void pollOnce();
      timer = setInterval(() => {
        void pollOnce();
      }, intervalMs);
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = 0;
    },
  };
}
