export default {
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:5183",
    viewport: { width: 420, height: 640 },
  },
  webServer: [
    {
      command: "npm run dev -- --port 5183",
      url: "http://127.0.0.1:5183",
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        VITE_COMPANION_EVENT_URL: "http://127.0.0.1:5184/events",
        VITE_COMPANION_SETTINGS_URL: "http://127.0.0.1:5184/settings/overlay",
      },
    },
    {
      command: "npm run event-server",
      url: "http://127.0.0.1:5184/healthz",
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        EVENT_PORT: "5184",
        AI_PROVIDER: "",
        AI_API_KEY: "",
        AI_MODEL: "",
        GEMINI_API_KEY: "",
        GOOGLE_API_KEY: "",
        OPENAI_API_KEY: "",
      },
    },
  ],
};
