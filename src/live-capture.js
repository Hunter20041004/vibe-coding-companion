import path from "node:path";

export function createLiveCaptureLaunch({
  provider,
  projectRoot,
  now = new Date(),
  env = process.env,
  eventUrl = "http://127.0.0.1:5174/events",
}) {
  if (!["codex", "claude-code"].includes(provider)) {
    throw new Error(`Unsupported live capture provider: ${provider}`);
  }

  const captureFile = path.join(
    projectRoot,
    `artifacts/hook-payloads/${provider}-live-${toFileTimestamp(now)}.jsonl`
  );

  return {
    command: getCommand(provider, env),
    args: getArgs(provider, projectRoot),
    captureFile,
    env: {
      ...env,
      EVENT_URL: eventUrl,
      HOOK_CAPTURE_FILE: captureFile,
    },
  };
}

function getCommand(provider, env) {
  if (provider === "codex") {
    return env.CODEX_BIN ?? "codex";
  }

  return env.CLAUDE_BIN ?? "claude";
}

function getArgs(provider, projectRoot) {
  if (provider === "codex") {
    return ["--no-alt-screen", "-C", projectRoot];
  }

  return [];
}

function toFileTimestamp(date) {
  return date.toISOString().replaceAll(":", "-").replaceAll(".", "-");
}
