#!/usr/bin/env node
import { spawn } from "node:child_process";

const children = [
  spawn("npm", ["run", "dev", "--", "--port", "5173"], {
    stdio: "inherit",
  }),
  spawn("npm", ["run", "event-server"], {
    stdio: "inherit",
  }),
];

const shutdown = () => {
  for (const child of children) {
    child.kill("SIGTERM");
  }
};

for (const child of children) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      shutdown();
      process.exit(code);
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
