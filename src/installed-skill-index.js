import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function loadInstalledSkills({
  roots = defaultSkillRoots(),
  readFile = fs.readFile,
  readdir = fs.readdir,
} = {}) {
  const skillFiles = [];
  for (const root of roots) {
    await collectSkillFiles(root, { skillFiles, readdir });
  }

  const skills = [];
  for (const skillPath of skillFiles.sort()) {
    const metadata = parseSkillMetadata(await readFile(skillPath, "utf8"));
    if (!metadata.name) continue;
    skills.push({
      name: metadata.name,
      description: metadata.description,
      path: skillPath,
    });
  }

  return skills;
}

export function createInstalledSkillLoader({
  ttlMs = 5000,
  load = loadInstalledSkills,
} = {}) {
  let cachedAt = 0;
  let cachedSkills = null;

  return async () => {
    const now = Date.now();
    if (cachedSkills && now - cachedAt < ttlMs) {
      return cachedSkills;
    }

    cachedSkills = await load();
    cachedAt = now;
    return cachedSkills;
  };
}

export function defaultSkillRoots({
  homeDir = os.homedir(),
  codexHome = process.env.CODEX_HOME,
} = {}) {
  const base = codexHome || path.join(homeDir, ".codex");
  return [path.join(base, "skills"), path.join(base, "plugins", "cache")];
}

export function parseSkillMetadata(content) {
  const match = String(content).match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { name: "", description: "" };

  const metadata = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const separator = rawLine.indexOf(":");
    if (separator === -1) continue;
    const key = rawLine.slice(0, separator).trim();
    const value = rawLine.slice(separator + 1).trim();
    if (key === "name" || key === "description") {
      metadata[key] = value.replace(/^["']|["']$/g, "");
    }
  }

  return {
    name: metadata.name ?? "",
    description: metadata.description ?? "",
  };
}

async function collectSkillFiles(root, { skillFiles, readdir }) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isFile() && entry.name === "SKILL.md") {
      skillFiles.push(entryPath);
    } else if (entry.isDirectory()) {
      await collectSkillFiles(entryPath, { skillFiles, readdir });
    }
  }
}
