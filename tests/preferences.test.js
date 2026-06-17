// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { createPreferenceStore } from "../src/preferences.js";

describe("Preference store", () => {
  it("saves and restores anchor, scale, and mode", () => {
    const store = createPreferenceStore(window.localStorage);

    store.save({
      anchor: { x: 24, y: 68 },
      scale: 1.35,
      mode: "showcase",
    });

    expect(store.load()).toEqual({
      anchor: { x: 24, y: 68 },
      scale: 1.35,
      mode: "showcase",
    });
  });

  it("falls back to defaults when stored data is invalid", () => {
    window.localStorage.setItem(
      "vibe-coding-companion-preferences",
      "{not-json"
    );

    const store = createPreferenceStore(window.localStorage);

    expect(store.load()).toEqual({
      anchor: { x: 50, y: 46 },
      scale: 1,
      mode: "calm",
    });
  });
});
