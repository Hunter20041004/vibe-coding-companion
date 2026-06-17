const COPY_BY_MODE = {
  calm: {
    idle: "Waiting for a bug to chase.",
    thinking: "Thinking through the failure...",
    reading: "Reading the login handler...",
    coding: "Patching the silent button...",
    testing: "Running the failing test...",
    error: "The test failed. Trying another angle.",
    debugging: "Tracing the weird branch...",
    success: "Patch passed. Looking smug.",
    waiting: "Waiting for your review.",
  },
  snark: {
    idle: "Waiting politely. Suspiciously politely.",
    thinking: "Thinking. The bug is acting confident.",
    reading: "Peeking at the login code. It looks suspicious.",
    coding: "Applying a tiny patch with big opinions.",
    testing: "Asking the test if it feels better now...",
    error: "The test is being dramatic.",
    debugging: "Following the bug trail like it owes us money.",
    success: "Patch passed. The bug has left the chat.",
    waiting: "Your move. I will pretend to be patient.",
  },
  showcase: {
    idle: "Standing by for the next bug hunt.",
    thinking: "Plotting the fix sequence.",
    reading: "Scanning the login mystery.",
    coding: "Deploying pixel-powered patchwork.",
    testing: "Launching verification run.",
    error: "Impact detected. Re-routing the bug hunt.",
    debugging: "Deep scan engaged.",
    success: "Victory signal acquired.",
    waiting: "Awaiting the next command.",
  },
};

export function getStatusCopy(state, mode = "calm") {
  return (COPY_BY_MODE[mode] ?? COPY_BY_MODE.calm)[state] ?? COPY_BY_MODE.calm.idle;
}
