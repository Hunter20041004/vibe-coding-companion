export function normalizeHookPayload(provider, payload) {
  if (!["claude-code", "codex"].includes(provider)) {
    return null;
  }

  const eventName = getEventName(payload);
  const toolName = getToolName(payload);
  const toolInput = getToolInput(payload);
  const toolResponse = getToolResponse(payload);
  const companionTool = classifyTool(toolName, toolInput);

  if (eventName === "UserPromptSubmit") {
    return { type: "prompt:submitted" };
  }

  if (eventName === "Stop") {
    return { type: "turn:complete" };
  }

  if (eventName === "PreToolUse" && companionTool) {
    return { type: "tool:start", tool: companionTool };
  }

  if (eventName === "PostToolUse" && companionTool === "test") {
    return {
      type: "tool:finish",
      tool: "test",
      status: getTestStatus(toolResponse),
    };
  }

  if (eventName === "PostToolUseFailure" && companionTool === "test") {
    return { type: "tool:finish", tool: "test", status: "failed" };
  }

  return null;
}

function getEventName(payload = {}) {
  return payload.hook_event_name ?? payload.event ?? payload.hookEventName;
}

function getToolName(payload = {}) {
  return payload.tool_name ?? payload.tool ?? payload.toolName;
}

function getToolInput(payload = {}) {
  return payload.tool_input ?? payload.input ?? payload.toolInput ?? {};
}

function getToolResponse(payload = {}) {
  return payload.tool_response ?? payload.result ?? payload.toolResponse ?? {};
}

function getExitCode(response = {}) {
  return response.exit_code ?? response.exitCode;
}

function getTestStatus(response = {}) {
  const exitCode = getExitCode(response);

  if (exitCode !== undefined) {
    return exitCode === 0 ? "passed" : "failed";
  }

  if (typeof response === "string") {
    const output = response.toLowerCase();
    const hasFailure = /\b(failed|failures?|exit code [1-9]\d*)\b/.test(
      output
    );
    const hasPass = /\bpassed\b/.test(output);

    if (hasPass && !hasFailure) {
      return "passed";
    }
  }

  return "failed";
}

function isTestCommand(command = "") {
  return /\b(npm|pnpm|yarn|bun)\s+(run\s+)?test(:[\w-]+)?\b|\b(vitest|jest|playwright|pytest)\b|\bcargo\s+test\b|\bgo\s+test\b/.test(
    command
  );
}

function isReadCommand(command = "") {
  return /\b(cat|ls|find|rg|grep|sed|awk|head|tail)\b/.test(command);
}

function classifyTool(toolName, toolInput = {}) {
  if (toolName === "Bash" && isTestCommand(toolInput.command)) {
    return "test";
  }

  if (toolName === "Bash" && isReadCommand(toolInput.command)) {
    return "read";
  }

  if (["Edit", "Write", "MultiEdit", "apply_patch"].includes(toolName)) {
    return "edit";
  }

  if (["Read", "Grep", "Glob"].includes(toolName)) {
    return "read";
  }

  return null;
}
