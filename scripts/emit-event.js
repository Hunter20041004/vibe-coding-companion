#!/usr/bin/env node
import { eventFromAlias } from "../src/event-cli.js";

const alias = process.argv[2];
const eventUrl = process.env.EVENT_URL ?? "http://127.0.0.1:5174/events";

if (!alias) {
  console.error("Usage: npm run emit:event -- <event-alias>");
  process.exit(1);
}

const event = eventFromAlias(alias);
const response = await fetch(eventUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(event),
});

if (!response.ok) {
  console.error(`Failed to emit ${alias}: HTTP ${response.status}`);
  process.exit(1);
}

const payload = await response.json();
console.log(`Emitted ${alias} as event #${payload.id}`);
