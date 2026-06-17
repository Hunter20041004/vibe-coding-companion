#!/usr/bin/env node
import {
  defaultCompanionEnvPath,
  openSetupKeyPage,
  startCompanionServices,
  stopCompanionServices,
} from "../src/companion-launcher.js";

const command = process.argv[2] ?? "start";
const cwd = process.cwd();

async function setupKey() {
  await start();
  await openSetupKeyPage();
  console.log(
    `Opened local setup page. It will save settings to ${defaultCompanionEnvPath()}`
  );
}

async function start() {
  await stopCompanionServices({ cwd });
  const result = await startCompanionServices({ cwd });
  const summary = result.services
    .map((service) => `${service.id}:${service.pid}`)
    .join(", ");
  console.log(`Started companion services in the background: ${summary}`);
}

async function stop() {
  const result = await stopCompanionServices({ cwd });
  if (result.stopped.length === 0) {
    console.log("No companion services were running.");
    return;
  }
  const summary = result.stopped
    .map((service) => `${service.id}:${service.pid}`)
    .join(", ");
  console.log(`Stopped companion services: ${summary}`);
}

try {
  if (command === "setup-key") {
    await setupKey();
  } else if (command === "start") {
    await start();
  } else if (command === "stop") {
    await stop();
  } else {
    console.error(`Unknown companion command: ${command}`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
