import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse, stringify } from "yaml";

const ROOT = path.resolve(import.meta.dirname, "..");
const CI_WORKFLOW = path.join(ROOT, ".github/workflows/ci.yml");
const CI_COMMANDS = [
  "npm ci",
  "npm test",
  "npm run build",
  "npx playwright install --with-deps chromium",
  "npm run test:e2e",
  "npm audit --audit-level=high",
];

function assertCiWorkflowContract(source) {
  const workflow = parse(source);

  expect(workflow.name).toBe("CI");
  expect(workflow.on).toEqual({ push: null, pull_request: null });
  expect(workflow.permissions).toEqual({ contents: "read" });
  expect(workflow.env).toBeUndefined();
  expect(workflow.concurrency).toMatchObject({
    "cancel-in-progress": true,
  });
  expect(workflow.concurrency.group).toEqual(expect.any(String));

  expect(Object.keys(workflow.jobs)).toEqual(["verify"]);
  const job = workflow.jobs.verify;
  expect(job["runs-on"]).toBe("ubuntu-latest");
  expect(job["timeout-minutes"]).toBe(25);
  expect(job.permissions).toBeUndefined();
  expect(job.services).toBeUndefined();
  expect(job.env).toBeUndefined();
  for (const step of job.steps) {
    expect(step["continue-on-error"]).toBeUndefined();
    expect(step.env).toBeUndefined();
  }

  const actionSteps = job.steps.filter((step) => step.uses);
  expect(actionSteps).toEqual([
    {
      name: "Checkout",
      uses: "actions/checkout@v4",
      with: { "persist-credentials": false },
    },
    {
      name: "Set up Node.js",
      uses: "actions/setup-node@v4",
      with: { "node-version": "22", cache: "npm" },
    },
  ]);
  expect(job.steps.map((step) => step.run).filter(Boolean)).toEqual(CI_COMMANDS);
  expect(job.steps).toHaveLength(actionSteps.length + CI_COMMANDS.length);

  const serialized = JSON.stringify(workflow);
  expect(serialized).not.toMatch(/\$\{\{\s*secrets\./i);
  expect(serialized).not.toMatch(/(?:GOOGLE|GEMINI)[A-Z0-9_]*?(?:KEY|TOKEN|SECRET)/i);
}

describe("portfolio presentation", () => {
  it("declares a deterministic evidence command", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    expect(pkg.scripts["portfolio:capture"]).toBe(
      "playwright test e2e/portfolio-evidence.spec.js",
    );
  });

  it("keeps CI verification least-privilege and offline", () => {
    const source = fs.readFileSync(CI_WORKFLOW, "utf8");
    assertCiWorkflowContract(source);

    const hostileVariants = [
      (workflow) => {
        workflow.permissions.contents = "write";
      },
      (workflow) => {
        workflow.jobs.lint = { "runs-on": "ubuntu-latest", steps: [] };
      },
      (workflow) => {
        workflow.jobs.verify["timeout-minutes"] = 26;
      },
      (workflow) => {
        workflow.jobs.verify.steps.find((step) => step.uses?.includes("setup-node"))[
          "with"
        ]["node-version"] = "20";
      },
      (workflow) => {
        workflow.jobs.verify.steps.find((step) => step.run === "npm test").run =
          "npm test || true";
      },
      (workflow) => {
        workflow.jobs.verify.steps.find((step) => step.run === "npm test")[
          "continue-on-error"
        ] = true;
      },
      (workflow) => {
        workflow.env = { AI_PROVIDER: "enabled" };
      },
      (workflow) => {
        workflow.jobs.verify.steps.find((step) => step.run === "npm test").env = {
          AI_API_KEY: "placeholder",
        };
      },
      (workflow) => {
        workflow.jobs.verify.env = {
          GEMINI_API_KEY: "${{ secrets.GEMINI_API_KEY }}",
        };
      },
      (workflow) => {
        workflow.jobs.verify.services = {
          provider: { image: "external/provider:latest" },
        };
      },
      (workflow) => {
        delete workflow.concurrency;
      },
    ];

    for (const mutate of hostileVariants) {
      const hostile = parse(source);
      mutate(hostile);
      expect(() => assertCiWorkflowContract(stringify(hostile))).toThrow();
    }
  });

  it("stores real recommendation image and video evidence", () => {
    const screenshot = fs.readFileSync(
      path.join(ROOT, "docs/screenshots/dashboard.png"),
    );
    const videoPath = path.join(ROOT, "docs/demo/skill-recommendation.webm");

    expect.soft([...screenshot.subarray(0, 8)]).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
    expect.soft(screenshot.readUInt32BE(16)).toBe(1440);
    expect.soft(screenshot.readUInt32BE(20)).toBe(900);
    expect.soft(fs.existsSync(videoPath)).toBe(true);
    if (fs.existsSync(videoPath)) {
      expect(fs.statSync(videoPath).size).toBeGreaterThan(100 * 1024);
    }
  });

  it("explains human-in-the-loop recommendation gating", () => {
    const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
    expect(readme).toContain("Human-in-the-loop");
    expect(readme).toContain("Executive Summary");
    expect(readme).toContain("deterministic Skill recommendation");
    expect(readme).toContain(
      "High-confidence recommendations may speak through the overlay",
    );
    expect(readme).toContain(
      "lower-confidence recommendations remain visible in the Console",
    );
    expect(readme).not.toContain(
      "A recommendation is surfaced only when it clears the confidence threshold; otherwise the companion stays quiet.",
    );
  });

  it("protects the documented privacy boundary and complete MIT scope", () => {
    const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
    const license = fs.readFileSync(path.join(ROOT, "LICENSE"), "utf8");

    expect(readme).toContain("## 安全與隱私");
    expect(readme).toContain("### 本機服務的安全邊界");
    expect(readme).toContain("Event server 只監聽 loopback");
    expect(readme).toContain("事件流不保存原始 prompt");
    expect(readme).toMatch(
      /Google AI Studio key[\s\S]{0,160}\.vibe-coding-companion\.env[\s\S]{0,80}0600/,
    );
    expect(readme).toMatch(
      /Vision context[\s\S]{0,120}按下按鈕後擷取一次[\s\S]{0,120}不會背景連續監看/,
    );
    expect(readme).toMatch(
      /HTTP 請求[\s\S]{0,80}驗證 `Host`[\s\S]{0,160}127\.0\.0\.1[\s\S]{0,80}localhost[\s\S]{0,80}::1/,
    );
    expect(readme).toMatch(
      /CORS[\s\S]{0,100}精確來源[\s\S]{0,80}不使用萬用字元/,
    );
    expect(readme).toMatch(
      /API key 與原始 prompt[\s\S]{0,100}event log[\s\S]{0,120}只回傳是否已設定[\s\S]{0,80}不回傳 key/,
    );

    expect(license).toContain("MIT License");
    expect(license).toContain("Permission is hereby granted, free of charge");
    expect(license).toMatch(
      /copyright notice and this permission notice shall be included[\s\S]{0,100}copies or substantial portions of the Software/i,
    );
    expect(license).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
    expect(license).toMatch(
      /IN NO EVENT SHALL THE\s+AUTHORS OR COPYRIGHT HOLDERS BE LIABLE/,
    );
    expect(license).toContain(
      "This license applies only to code in this repository authored by Hunter",
    );
    expect(license).toContain(
      "It does not grant rights to third-party assets or other",
    );
  });
});
