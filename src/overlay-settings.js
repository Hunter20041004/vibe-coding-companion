import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
export {
  DEFAULT_OVERLAY_SETTINGS,
  normalizeOverlaySettings,
} from "./overlay-settings-values.js";
import {
  DEFAULT_OVERLAY_SETTINGS,
  normalizeOverlaySettings,
} from "./overlay-settings-values.js";

export function defaultOverlaySettingsPath({ homeDir = os.homedir() } = {}) {
  return path.join(homeDir, ".vibe-coding-companion.overlay.json");
}

export async function readOverlaySettings({
  settingsPath = defaultOverlaySettingsPath(),
  readFile = fs.readFile,
} = {}) {
  try {
    return normalizeOverlaySettings(JSON.parse(await readFile(settingsPath, "utf8")));
  } catch (error) {
    if (error?.code === "ENOENT") return { ...DEFAULT_OVERLAY_SETTINGS };
    throw error;
  }
}

export async function writeOverlaySettings({
  settingsPath = defaultOverlaySettingsPath(),
  settings,
}) {
  const normalized = normalizeOverlaySettings(settings);
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, `${JSON.stringify(normalized, null, 2)}\n`, {
    mode: 0o600,
  });
  await fs.chmod(settingsPath, 0o600);
  return normalized;
}
