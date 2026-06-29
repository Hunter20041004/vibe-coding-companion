import fs from "node:fs/promises";
import path from "node:path";

const HOOK_CONFIGS = {
  codex: ".codex/hooks.json",
  claudeCode: ".claude/settings.local.json",
};

export function createReadinessDiagnostic({
  cwd = process.cwd(),
  access = fs.access,
  readFile = fs.readFile,
  killImpl = process.kill,
  detectForeground = null,
} = {}) {
  return async () => ({
    permissions: await detectPermissionState({ detectForeground }),
    hooks: {
      codex: await detectHookState({
        cwd,
        access,
        configPath: HOOK_CONFIGS.codex,
      }),
      claudeCode: await detectHookState({
        cwd,
        access,
        configPath: HOOK_CONFIGS.claudeCode,
      }),
    },
    promptWatcher: await detectPromptWatcherState({
      cwd,
      readFile,
      killImpl,
    }),
  });
}

async function detectHookState({ cwd, access, configPath }) {
  try {
    await access(path.join(cwd, configPath));
    return "ready";
  } catch {
    return "missing";
  }
}

async function detectPermissionState({ detectForeground }) {
  if (typeof detectForeground !== "function") {
    return "unknown";
  }

  try {
    const foreground = await detectForeground();
    return foreground?.accessibilityRegions?.length > 0
      ? "ready"
      : "needs-action";
  } catch {
    return "needs-action";
  }
}

async function detectPromptWatcherState({ cwd, readFile, killImpl }) {
  let serviceState;
  try {
    serviceState = JSON.parse(
      await readFile(
        path.join(cwd, "artifacts", "companion-services.json"),
        "utf8"
      )
    );
  } catch {
    return "blocked";
  }

  const promptWatcher = serviceState?.services?.find(
    (service) => service?.id === "prompt-watch"
  );
  const pid = Number(promptWatcher?.pid);
  if (!Number.isFinite(pid) || pid <= 0) {
    return "blocked";
  }

  try {
    killImpl(pid, 0);
    return "ready";
  } catch {
    return "blocked";
  }
}
