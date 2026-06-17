import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function defaultCompanionEnvPath({ homeDir = os.homedir() } = {}) {
  return path.join(homeDir, ".vibe-coding-companion.env");
}

function pidFilePath(cwd) {
  return path.join(cwd, "artifacts", "companion-services.json");
}

export async function writeGoogleAiStudioEnv({
  envPath = defaultCompanionEnvPath(),
  apiKey,
  model = "gemma-4-31b-it",
}) {
  if (!apiKey || apiKey.includes("\n") || apiKey.includes("\r")) {
    throw new Error("Google AI Studio API key must be a single non-empty line.");
  }

  await fs.mkdir(path.dirname(envPath), { recursive: true });
  await fs.writeFile(
    envPath,
    [
      "AI_PROVIDER=google",
      `GEMINI_API_KEY=${apiKey}`,
      `AI_MODEL=${model}`,
      "",
    ].join("\n"),
    { mode: 0o600 }
  );
  await fs.chmod(envPath, 0o600);
}

export async function promptForGoogleAiStudioKey({
  execFileImpl = execFileAsync,
} = {}) {
  const script = `
    set dialogResult to display dialog "貼上新的 Google AI Studio API key。輸入會被隱藏，並只會寫入 ~/.vibe-coding-companion.env。" default answer "" with hidden answer buttons {"取消", "儲存"} default button "儲存" cancel button "取消"
    return "text returned:" & text returned of dialogResult
  `;
  const { stdout } = await execFileImpl("osascript", ["-e", script]);
  const match = stdout.match(/text returned:([\s\S]*)$/);
  const apiKey = match?.[1]?.trim() ?? "";
  if (!apiKey || apiKey.includes("\n") || apiKey.includes("\r")) {
    throw new Error("Google AI Studio API key must be a single non-empty line.");
  }
  return apiKey;
}

export async function openSetupKeyPage({
  execFileImpl = execFileAsync,
  url = "http://127.0.0.1:5173/setup-key.html",
} = {}) {
  await execFileImpl("open", [url]);
}

export function parseEnvFile(content) {
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();
    if (!key) continue;
    env[key] = value;
  }
  return env;
}

export async function loadCompanionEnv({
  envPath = defaultCompanionEnvPath(),
  readFile = fs.readFile,
} = {}) {
  try {
    return parseEnvFile(await readFile(envPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
}

export function createCompanionLaunchPlan({
  cwd = process.cwd(),
  env = process.env,
} = {}) {
  const artifactsDir = path.join(cwd, "artifacts");
  const sharedEnv = {
    ...env,
    OVERLAY_URL: env.OVERLAY_URL ?? "http://127.0.0.1:5173/overlay.html",
    EVENT_URL: env.EVENT_URL ?? "http://127.0.0.1:5174/events",
  };

  return {
    services: [
      {
        id: "dev",
        command: "npm",
        args: ["run", "dev:all"],
        cwd,
        env: sharedEnv,
        detached: true,
        stdoutPath: path.join(artifactsDir, "companion-dev.log"),
        stderrPath: path.join(artifactsDir, "companion-dev.err.log"),
      },
      {
        id: "overlay",
        command: "npm",
        args: ["run", "overlay"],
        cwd,
        env: sharedEnv,
        detached: true,
        stdoutPath: path.join(artifactsDir, "companion-overlay.log"),
        stderrPath: path.join(artifactsDir, "companion-overlay.err.log"),
      },
    ],
  };
}

export async function startCompanionServices({
  cwd = process.cwd(),
  envPath = defaultCompanionEnvPath(),
  spawnImpl = spawn,
  openLogFile = fsSync.openSync,
  closeLogFile = fsSync.closeSync,
} = {}) {
  const loadedEnv = await loadCompanionEnv({ envPath });
  const plan = createCompanionLaunchPlan({
    cwd,
    env: {
      ...process.env,
      ...loadedEnv,
    },
  });
  const artifactsDir = path.join(cwd, "artifacts");
  await fs.mkdir(artifactsDir, { recursive: true });

  const services = [];
  for (const service of plan.services) {
    const stdoutFd = openLogFile(service.stdoutPath, "a");
    const stderrFd = openLogFile(service.stderrPath, "a");
    try {
      const child = spawnImpl(service.command, service.args, {
        cwd: service.cwd,
        env: service.env,
        detached: service.detached,
        stdio: ["ignore", stdoutFd, stderrFd],
        windowsHide: true,
      });
      child.unref();
      services.push({ id: service.id, pid: child.pid });
    } finally {
      closeLogFile(stdoutFd);
      closeLogFile(stderrFd);
    }
  }

  await fs.writeFile(
    pidFilePath(cwd),
    `${JSON.stringify(
      {
        startedAt: new Date().toISOString(),
        services,
      },
      null,
      2
    )}\n`
  );

  return { services };
}

export async function stopCompanionServices({
  cwd = process.cwd(),
  killImpl = process.kill,
} = {}) {
  const filePath = pidFilePath(cwd);
  let state;
  try {
    state = JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return { stopped: [] };
    throw error;
  }

  const stopped = [];
  for (const service of state.services ?? []) {
    if (!service.pid) continue;
    try {
      killImpl(-service.pid, "SIGTERM");
      stopped.push({ id: service.id, pid: service.pid });
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
  }

  await fs.rm(filePath, { force: true });
  return { stopped };
}
