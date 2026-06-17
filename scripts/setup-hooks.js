#!/usr/bin/env node
import { installHookConfig } from "../src/hook-installer.js";

const provider = process.argv[2];

if (!provider) {
  console.error("Usage: npm run setup:hooks -- <claude-code|codex>");
  process.exit(1);
}

try {
  const result = await installHookConfig({
    provider,
    projectRoot: process.cwd(),
  });

  console.log(`Installed hook config: ${result.destination}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
