import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

export async function installHookConfig({ provider, projectRoot }) {
  const config = PROVIDERS[provider];

  if (!config) {
    throw new Error(`Unsupported hook provider: ${provider}`);
  }

  const destination = path.join(projectRoot, config.destination);
  const source = path.join(process.cwd(), config.source);

  await fs.mkdir(path.dirname(destination), { recursive: true });
  try {
    await fs.copyFile(source, destination, constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(`Hook config already exists: ${destination}`);
    }

    throw error;
  }

  return { destination };
}

export async function ensureHookConfig({ provider, projectRoot }) {
  const config = getProviderConfig(provider);
  const destination = path.join(projectRoot, config.destination);

  try {
    await fs.access(destination);
    return { destination, installed: false };
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  const result = await installHookConfig({ provider, projectRoot });
  return { ...result, installed: true };
}

function getProviderConfig(provider) {
  const config = PROVIDERS[provider];

  if (!config) {
    throw new Error(`Unsupported hook provider: ${provider}`);
  }

  return config;
}

const PROVIDERS = {
  "claude-code": {
    source: "hooks/claude-code/settings.example.json",
    destination: ".claude/settings.local.json",
  },
  codex: {
    source: "hooks/codex/hooks.example.json",
    destination: ".codex/hooks.json",
  },
};
