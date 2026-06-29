import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const TEXT_INPUT_ROLES = new Set(["AXTextArea", "AXTextField"]);
const DIRECT_PROMPT_APPS = ["codex", "claude", "claude code"];

export function createPromptDraftWatcher({
  readFocusedPrompt = detectMacPromptDraft,
  emitPromptDraft = postPromptDraft,
  getNow = () => Date.now(),
  settleMs = 500,
  minChars = 18,
} = {}) {
  let pendingPrompt = "";
  let pendingChangedAt = 0;
  let lastEmittedPrompt = "";

  return {
    async checkOnce() {
      let snapshot;
      try {
        snapshot = await readFocusedPrompt();
      } catch {
        return null;
      }

      if (!isAgentPromptInput(snapshot)) {
        pendingPrompt = "";
        pendingChangedAt = 0;
        return null;
      }

      const prompt = normalizePrompt(snapshot.prompt);
      if (prompt.length < minChars) {
        pendingPrompt = "";
        pendingChangedAt = 0;
        return null;
      }

      const now = getNow();
      if (prompt !== pendingPrompt) {
        pendingPrompt = prompt;
        pendingChangedAt = now;
        return null;
      }

      if (prompt === lastEmittedPrompt || now - pendingChangedAt < settleMs) {
        return null;
      }

      lastEmittedPrompt = prompt;
      return emitPromptDraft({ prompt, source: "accessibility" });
    },
  };
}

export async function detectMacPromptDraft({
  execFileImpl = execFileAsync,
  timeoutMs = 1000,
} = {}) {
  const script = `
    tell application "System Events"
      set frontProcess to first application process whose frontmost is true
      set appName to name of frontProcess
      set windowTitle to ""
      set focusedRole to ""
      set focusedValue to ""
      set shouldReadFocusedPrompt to false
      if appName contains "Codex" or appName contains "codex" or appName contains "Claude" or appName contains "claude" then
        set shouldReadFocusedPrompt to true
      end if
      try
        set frontWindow to front window of frontProcess
        set windowTitle to name of frontWindow
      end try
      if shouldReadFocusedPrompt then
        try
          set focusedElement to value of attribute "AXFocusedUIElement" of frontProcess
          set focusedRole to role of focusedElement as string
          if focusedRole is "AXTextArea" or focusedRole is "AXTextField" then
            try
              set focusedValue to value of focusedElement as string
            end try
          end if
        end try
      end if
      return appName & linefeed & windowTitle & linefeed & focusedRole & linefeed & focusedValue
    end tell
  `;
  const { stdout } = await execFileImpl("osascript", ["-e", script], {
    timeout: timeoutMs,
  });

  return parseMacPromptDraftOutput(stdout);
}

export function parseMacPromptDraftOutput(output) {
  const [appName = "", windowTitle = "", focusedRole = "", ...promptLines] =
    String(output).replace(/\r\n/g, "\n").split("\n");

  return {
    appName,
    windowTitle,
    focusedRole,
    prompt: promptLines.join("\n").trimEnd(),
  };
}

export async function postPromptDraft({
  prompt,
  source = "accessibility",
  eventUrl = process.env.EVENT_URL ?? "http://127.0.0.1:5174/events",
  fetchImpl = globalThis.fetch,
} = {}) {
  const response = await fetchImpl(eventUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: "prompt:draft",
      source,
      prompt,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to emit prompt draft: HTTP ${response.status}`);
  }

  return response.json();
}

export function isAgentPromptInput(snapshot = {}) {
  return (
    TEXT_INPUT_ROLES.has(String(snapshot.focusedRole ?? "")) &&
    isDirectPromptApp(snapshot.appName)
  );
}

function normalizePrompt(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isDirectPromptApp(appName = "") {
  const app = String(appName).toLowerCase();
  return DIRECT_PROMPT_APPS.some((target) => app.includes(target));
}
