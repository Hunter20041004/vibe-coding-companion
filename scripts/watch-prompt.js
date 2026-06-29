#!/usr/bin/env node
import { createPromptDraftWatcher } from "../src/prompt-draft-watcher.js";

const intervalMs = Number(process.env.PROMPT_WATCH_INTERVAL_MS ?? 1200);
const watcher = createPromptDraftWatcher({
  settleMs: Number(process.env.PROMPT_DRAFT_SETTLE_MS ?? 500),
  minChars: Number(process.env.PROMPT_DRAFT_MIN_CHARS ?? 18),
});

console.log(
  `Prompt watcher polling focused Codex/Claude text input every ${intervalMs}ms.`
);

const timer = setInterval(() => {
  void watcher.checkOnce();
}, intervalMs);
void watcher.checkOnce();

function shutdown() {
  clearInterval(timer);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
