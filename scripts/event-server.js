#!/usr/bin/env node
import { createLocalEventServer } from "../src/local-event-server.js";
import { createEventServerOptions } from "../src/event-server-runtime.js";

const port = Number(process.env.EVENT_PORT ?? 5174);
const server = createLocalEventServer(createEventServerOptions());

await server.listen(port);
console.log(`Event server listening at ${server.url()}`);

const close = async () => {
  await server.close();
  process.exit(0);
};

process.on("SIGINT", close);
process.on("SIGTERM", close);
