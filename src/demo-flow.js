const BUG_FIX_FLOW = [
  "thinking",
  "reading",
  "coding",
  "testing",
  "error",
  "debugging",
  "testing",
  "success",
  "waiting",
];

export function createDemoFlow({ onState, stepMs = 900 }) {
  if (typeof onState !== "function") {
    throw new Error("createDemoFlow requires an onState callback.");
  }

  const timers = [];

  return {
    start() {
      this.stop();

      BUG_FIX_FLOW.forEach((state, index) => {
        const timer = setTimeout(() => onState(state), index * stepMs);
        timers.push(timer);
      });
    },
    stop() {
      while (timers.length > 0) {
        clearTimeout(timers.pop());
      }
    },
  };
}
