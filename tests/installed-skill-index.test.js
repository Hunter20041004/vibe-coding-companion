import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadInstalledSkills } from "../src/installed-skill-index.js";

describe("Installed skill index", () => {
  it("loads skill metadata from installed SKILL.md files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "skill-index-"));
    await fs.mkdir(path.join(root, "skills", "diagnose"), { recursive: true });
    await fs.writeFile(
      path.join(root, "skills", "diagnose", "SKILL.md"),
      [
        "---",
        "name: diagnose",
        "description: Disciplined diagnosis loop for hard bugs and failing tests.",
        "---",
        "",
        "# Diagnose",
      ].join("\n")
    );

    await expect(
      loadInstalledSkills({ roots: [path.join(root, "skills")] })
    ).resolves.toEqual([
      {
        name: "diagnose",
        description: "Disciplined diagnosis loop for hard bugs and failing tests.",
        path: path.join(root, "skills", "diagnose", "SKILL.md"),
      },
    ]);
  });
});
