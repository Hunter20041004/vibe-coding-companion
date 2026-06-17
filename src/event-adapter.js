export function createEventAdapter(onState) {
  if (typeof onState !== "function") {
    throw new Error("createEventAdapter requires an onState callback.");
  }

  return {
    sendEvent(event) {
      const state = mapEventToState(event);

      if (state) {
        onState(state, event);
      }

      return state;
    },
  };
}

export function mapEventToState(event = {}) {
  if (event.type === "ai:decision") {
    return event.state ?? null;
  }

  if (event.type === "prompt:submitted") {
    return "thinking";
  }

  if (event.type === "turn:complete") {
    return "waiting";
  }

  if (event.type === "tool:start") {
    return mapStartedTool(event.tool);
  }

  if (event.type === "tool:finish" && event.tool === "test") {
    return event.status === "passed" ? "success" : "error";
  }

  return null;
}

function mapStartedTool(tool) {
  const states = {
    read: "reading",
    search: "reading",
    edit: "coding",
    write: "coding",
    test: "testing",
    debug: "debugging",
  };

  return states[tool] ?? null;
}
