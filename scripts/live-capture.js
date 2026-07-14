#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createLiveCaptureLaunch } from "../src/live-capture.js";
import { ensureHookConfig } from "../src/hook-installer.js";

const provider = process.argv[2];
const shouldPrint = process.argv.includes("--print");

if (!provider) {
  console.error("Usage: npm run live:codex OR npm run live:claude");
  process.exit(1);
}

const projectRoot = process.env.LIVE_CAPTURE_PROJECT_ROOT ?? process.cwd();
const hookConfig = await ensureHookConfig({ provider, projectRoot });
const launch = createLiveCaptureLaunch({ provider, projectRoot });

await fs.mkdir(path.dirname(launch.captureFile), { recursive: true });

if (shouldPrint) {
  process.stdout.write(
    `${JSON.stringify(
      {
        hookConfig,
        launch: {
          ...launch,
          env: {
            EVENT_URL: launch.env.EVENT_URL,
            HOOK_CAPTURE_FILE: launch.env.HOOK_CAPTURE_FILE,
          },
        },
      },
      null,
      2
    )}\n`
  );
  process.exit(0);
}

console.log(
  `${hookConfig.installed ? "Installed" : "Using"} hook config: ${
    hookConfig.destination
  }`
);
console.log(`Capturing hook payloads: ${launch.captureFile}`);
console.log("Run /hooks in the launched agent, then trust or confirm hooks.");

const child = spawn(launch.command, launch.args, {
  cwd: projectRoot,
  env: launch.env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Failed to launch ${provider}: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
