import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import playwrightConfig from "../playwright.config.js";

describe("Package scripts", () => {
  it("exposes a setup:hooks script for installing local hook configs", async () => {
    const packageJson = JSON.parse(await fs.readFile("package.json", "utf8"));

    expect(packageJson.scripts["setup:hooks"]).toBe(
      "node scripts/setup-hooks.js"
    );
  });

  it("exposes live capture scripts for launching interactive agents", async () => {
    const packageJson = JSON.parse(await fs.readFile("package.json", "utf8"));

    expect(packageJson.scripts["live:codex"]).toBe(
      "node scripts/live-capture.js codex"
    );
    expect(packageJson.scripts["live:claude"]).toBe(
      "node scripts/live-capture.js claude-code"
    );
  });

  it("exposes an overlay script for launching the desktop sprite", async () => {
    const packageJson = JSON.parse(await fs.readFile("package.json", "utf8"));

    expect(packageJson.scripts.overlay).toBe("electron scripts/overlay-main.js");
  });

  it("declares Electron for the desktop overlay runtime", async () => {
    const packageJson = JSON.parse(await fs.readFile("package.json", "utf8"));

    expect(packageJson.devDependencies.electron).toBeTruthy();
  });

  it("exposes companion launcher scripts for clean local usage", async () => {
    const packageJson = JSON.parse(await fs.readFile("package.json", "utf8"));

    expect(packageJson.scripts["companion:setup-key"]).toBe(
      "node scripts/companion.js setup-key"
    );
    expect(packageJson.scripts["companion:start"]).toBe(
      "node scripts/companion.js start"
    );
    expect(packageJson.scripts["companion:stop"]).toBe(
      "node scripts/companion.js stop"
    );
  });

  it("runs E2E against isolated companion ports instead of reusing local services", () => {
    expect(playwrightConfig.webServer).toEqual([
      expect.objectContaining({
        url: "http://127.0.0.1:5183",
        reuseExistingServer: false,
        env: expect.objectContaining({
          VITE_COMPANION_EVENT_URL: "http://127.0.0.1:5184/events",
        }),
      }),
      expect.objectContaining({
        url: "http://127.0.0.1:5184/healthz",
        reuseExistingServer: false,
        env: expect.objectContaining({
          EVENT_PORT: "5184",
        }),
      }),
    ]);
    expect(playwrightConfig.use.baseURL).toBe("http://127.0.0.1:5183");
  });

  it("exposes one verify script for the full local quality gate", async () => {
    const packageJson = JSON.parse(await fs.readFile("package.json", "utf8"));

    expect(packageJson.scripts.verify).toBe("npm test && npm run test:e2e");
  });
});
