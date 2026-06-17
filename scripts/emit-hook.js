#!/usr/bin/env node
import fs from "node:fs/promises";
import { appendHookCapture } from "../src/hook-capture.js";
import { normalizeAndEmitHook } from "../src/hook-cli.js";

const provider = process.argv[2];
const payloadPath = process.argv[3];
const eventUrl = process.env.EVENT_URL ?? "http://127.0.0.1:5174/events";
const captureFile = process.env.HOOK_CAPTURE_FILE;
const shouldPrintJson = process.env.HOOK_OUTPUT === "json";

if (!provider || !payloadPath) {
  console.error("Usage: npm run emit:hook -- <provider> <payload-json-file|->");
  process.exit(1);
}

const payload = JSON.parse(await readPayload(payloadPath));
const result = await normalizeAndEmitHook({
  provider,
  payload,
  eventUrl,
  capturePayload: captureFile
    ? (entry) => appendHookCapture(captureFile, entry)
    : undefined,
});

if (!result.emitted) {
  printHookOutput("No companion event emitted for this hook payload.");
  process.exit(0);
}

printHookOutput(
  `Emitted hook event as #${result.id}: ${JSON.stringify(result.event)}`
);

async function readPayload(path) {
  if (path === "-") {
    return await readStdin();
  }

  return fs.readFile(path, "utf8");
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let body = "";

    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      body += chunk;
    });
    process.stdin.on("end", () => resolve(body));
    process.stdin.on("error", reject);
  });
}

function printHookOutput(message) {
  if (shouldPrintJson) {
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  console.log(message);
}
