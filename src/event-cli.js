const ALIAS_EVENTS = {
  prompt: { type: "prompt:submitted" },
  read: { type: "tool:start", tool: "read" },
  edit: { type: "tool:start", tool: "edit" },
  test: { type: "tool:start", tool: "test" },
  "test-failed": { type: "tool:finish", tool: "test", status: "failed" },
  "test-passed": { type: "tool:finish", tool: "test", status: "passed" },
  complete: { type: "turn:complete" },
};

export function eventFromAlias(alias) {
  const event = ALIAS_EVENTS[alias];

  if (!event) {
    throw new Error(`Unknown event alias: ${alias}`);
  }

  return event;
}
