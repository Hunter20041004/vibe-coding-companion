export const AGENT_STATES = [
  "idle",
  "typing",
  "stuck",
  "thinking",
  "reading",
  "coding",
  "testing",
  "error",
  "debugging",
  "success",
  "waiting",
];

export function createAgentState(initialState = "idle") {
  let currentState = assertState(initialState);

  return {
    current() {
      return currentState;
    },
    set(nextState) {
      currentState = assertState(nextState);
      return currentState;
    },
  };
}

function assertState(state) {
  if (!AGENT_STATES.includes(state)) {
    throw new Error(`Unsupported agent state: ${state}`);
  }

  return state;
}
