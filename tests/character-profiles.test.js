import { describe, expect, it } from "vitest";
import {
  BUILTIN_CHARACTER_IDS,
  DEFAULT_CHARACTER_ID,
  getCharacterProfile,
  listCharacterProfiles,
} from "../src/character-profiles.js";

describe("Character profiles", () => {
  it("exposes three built-in companions with stable metadata", () => {
    expect(BUILTIN_CHARACTER_IDS).toEqual([
      "cosmic-jellyfish",
      "foam-ghost",
      "green-phosphor-pixel",
    ]);

    expect(listCharacterProfiles()).toEqual([
      expect.objectContaining({
        id: "cosmic-jellyfish",
        name: "宇宙水母",
        coachingBias: "navigation",
      }),
      expect.objectContaining({
        id: "foam-ghost",
        name: "奶泡幽靈",
        coachingBias: "gentle",
      }),
      expect.objectContaining({
        id: "green-phosphor-pixel",
        name: "綠磷光像素怪",
        coachingBias: "testing",
      }),
    ]);
  });

  it("returns the default companion when the requested id is invalid", () => {
    expect(DEFAULT_CHARACTER_ID).toBe("cosmic-jellyfish");

    expect(getCharacterProfile("unknown-character")).toEqual(
      expect.objectContaining({
        id: "cosmic-jellyfish",
        name: "宇宙水母",
      })
    );
  });
});
