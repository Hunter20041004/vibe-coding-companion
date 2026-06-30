// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { drawBlob, mountApp } from "../src/app.js";

describe("Vibe coding companion shell", () => {
  it("shows the overlay, idle state, vibe meter, and expanded debug panel on first load", () => {
    document.body.innerHTML = '<main id="app"></main>';

    mountApp(document.querySelector("#app"));

    expect(
      screenText("Vibe coding companion overlay")
    ).toBeTruthy();
    expect(screenText("idle")).toBeTruthy();
    expect(screenText("Vibe Meter")).toBeTruthy();
    expect(screenText("開發控制")).toBeTruthy();
    expect(document.querySelector("[data-debug-panel]").hasAttribute("hidden"))
      .toBe(false);
  });

  it("shows one English status line and a running light when testing starts", () => {
    document.body.innerHTML = '<main id="app"></main>';

    const app = mountApp(document.querySelector("#app"));
    app.setState("testing");

    const statusLines = document.querySelectorAll("[data-status-line]");

    expect(statusLines).toHaveLength(1);
    expect(statusLines[0].textContent).toBe("Running the failing test...");
    expect(document.querySelector("[data-status-light]").dataset.tone).toBe(
      "running"
    );
  });

  it("runs one session from the start button and offers replay after waiting", () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<main id="app"></main>';

    mountApp(document.querySelector("#app"), { demoStepMs: 100 });
    document.querySelector("[data-start-session]").click();
    vi.runAllTimers();

    expect(document.querySelector("[data-agent-state]").textContent).toBe(
      "waiting"
    );
    expect(document.querySelector("[data-start-session]").textContent).toBe(
      "重播"
    );

    vi.useRealTimers();
  });

  it("switches mode copy through the HUD and stores the selected mode", () => {
    document.body.innerHTML = '<main id="app"></main>';

    const app = mountApp(document.querySelector("#app"), {
      storage: window.localStorage,
    });
    document.querySelector('[data-mode-option="showcase"]').click();
    app.setState("error");

    expect(document.querySelector("[data-status-line]").textContent).toBe(
      "Impact detected. Re-routing the bug hunt."
    );
    expect(window.localStorage.getItem("vibe-coding-companion-preferences"))
      .toContain('"mode":"showcase"');
  });

  it("updates and stores the character base scale from the size control", () => {
    document.body.innerHTML = '<main id="app"></main>';

    mountApp(document.querySelector("#app"), {
      storage: window.localStorage,
    });
    const scaleControl = document.querySelector("[data-scale-control]");
    scaleControl.value = "1.4";
    scaleControl.dispatchEvent(new Event("input", { bubbles: true }));

    expect(document.querySelector("[data-character-stage]").dataset.scale).toBe(
      "1.4"
    );
    expect(window.localStorage.getItem("vibe-coding-companion-preferences"))
      .toContain('"scale":1.4');
  });

  it("updates and stores the character anchor when dragged", () => {
    document.body.innerHTML = '<main id="app"></main>';

    mountApp(document.querySelector("#app"), {
      storage: window.localStorage,
    });
    const stage = document.querySelector("[data-character-stage]");

    stage.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, clientX: 20, clientY: 20 })
    );
    window.dispatchEvent(
      new MouseEvent("pointermove", { bubbles: true, clientX: 80, clientY: 72 })
    );
    window.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));

    expect(stage.dataset.anchorX).toBe("80");
    expect(stage.dataset.anchorY).toBe("72");
    expect(window.localStorage.getItem("vibe-coding-companion-preferences"))
      .toContain('"anchor":{"x":80,"y":72}');
  });

  it("accepts observable agent events through the public companion API", () => {
    document.body.innerHTML = '<main id="app"></main>';

    const app = mountApp(document.querySelector("#app"));
    const mappedState = app.sendEvent({
      type: "tool:finish",
      tool: "test",
      status: "failed",
    });

    expect(mappedState).toBe("error");
    expect(document.querySelector("[data-agent-state]").textContent).toBe(
      "error"
    );
    expect(document.querySelector("[data-status-light]").dataset.tone).toBe(
      "blocked"
    );
  });

  it("uses AI decision metadata to personalize the web prototype reaction", () => {
    document.body.innerHTML = '<main id="app"></main>';

    const app = mountApp(document.querySelector("#app"));
    app.sendEvent({
      type: "ai:decision",
      state: "debugging",
      intensity: "high",
      motion: "panic",
      line: "Tests are being dramatic.",
    });

    const stage = document.querySelector("[data-character-stage]");

    expect(document.querySelector("[data-agent-state]").textContent).toBe(
      "debugging"
    );
    expect(document.querySelector("[data-status-line]").textContent).toBe(
      "Tests are being dramatic."
    );
    expect(stage.dataset.aiIntensity).toBe("high");
    expect(stage.dataset.aiMotion).toBe("panic");
  });

  it("lets developers drive the companion from the event bridge playground", () => {
    document.body.innerHTML = '<main id="app"></main>';

    mountApp(document.querySelector("#app"));
    document.querySelector('[data-event-trigger="test-failed"]').click();

    expect(screenText("事件橋接")).toBe(true);
    expect(document.querySelector("[data-agent-state]").textContent).toBe(
      "error"
    );
    expect(document.querySelector("[data-event-last]").textContent).toBe(
      "Last event: tool:finish test failed"
    );
  });

  it("polls a local event endpoint into the companion state", async () => {
    document.body.innerHTML = '<main id="app"></main>';

    const app = mountApp(document.querySelector("#app"), {
      eventUrl: "http://127.0.0.1:5174/events",
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          events: [
            {
              id: 1,
              event: {
                type: "tool:finish",
                tool: "test",
                status: "passed",
              },
            },
          ],
        }),
      }),
    });

    await app.pollEventsOnce();

    expect(document.querySelector("[data-agent-state]").textContent).toBe(
      "success"
    );
    expect(document.querySelector("[data-event-last]").textContent).toBe(
      "Last event: tool:finish test passed"
    );
  });

  it("keeps the last event label on observable events when an AI decision follows", async () => {
    document.body.innerHTML = '<main id="app"></main>';

    const app = mountApp(document.querySelector("#app"), {
      eventUrl: "http://127.0.0.1:5174/events",
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          events: [
            {
              id: 1,
              event: {
                type: "tool:finish",
                tool: "test",
                status: "failed",
              },
            },
            {
              id: 2,
              event: {
                type: "ai:decision",
                state: "debugging",
                intensity: "high",
                motion: "panic",
                line: "Investigating the failure.",
              },
            },
          ],
        }),
      }),
    });

    await app.pollEventsOnce();

    expect(document.querySelector("[data-agent-state]").textContent).toBe(
      "debugging"
    );
    expect(document.querySelector("[data-event-last]").textContent).toBe(
      "Last event: tool:finish test failed"
    );
  });

  it("draws dedicated pixels for focus-safe companion poses", () => {
    const basePixels = drawPose("float");

    for (const pose of [
      "edge-peek",
      "work-buddy",
      "test-watch",
      "quick-startle",
      "tiny-celebrate",
      "point",
    ]) {
      expect(drawPose(pose).length).toBeGreaterThan(basePixels.length);
    }
  });

  it("draws the selected character palette on the canvas body", () => {
    expect(drawFrame({ characterId: "cosmic-jellyfish" }).fillStyles)
      .toContain("#8fd8ff");
    expect(drawFrame({ characterId: "foam-ghost" }).fillStyles)
      .toContain("#ffd6e8");
    expect(drawFrame({ characterId: "green-phosphor-pixel" }).fillStyles)
      .toContain("#9cff6a");
  });

  it("draws distinct silhouettes for each built-in character", () => {
    const signatures = [
      "cosmic-jellyfish",
      "foam-ghost",
      "green-phosphor-pixel",
    ].map((characterId) =>
      drawFrame({ characterId }).pixels
        .map(({ x, y, width, height }) => `${x},${y},${width},${height}`)
        .join("|")
    );

    expect(new Set(signatures)).toHaveLength(3);
  });
});

function screenText(text) {
  return document.body.textContent.includes(text);
}

function drawPose(pose) {
  return drawFrame({ pose }).pixels;
}

function drawFrame(frame = {}) {
  const pixels = [];
  const fillStyles = [];
  const context = {
    clearRect() {},
    save() {},
    restore() {},
    translate() {},
    scale() {},
    rotate() {},
    fillRect(x, y, width, height) {
      pixels.push({ x, y, width, height });
    },
    set fillStyle(value) {
      this.currentFillStyle = value;
      fillStyles.push(value);
    },
    get fillStyle() {
      return this.currentFillStyle;
    },
  };
  const canvas = {
    width: 220,
    height: 220,
    getContext: () => context,
  };

  drawBlob(canvas, {
    pose: "float",
    time: 0,
    scale: 1,
    mode: "snark",
    mood: "steady",
    motion: { amplitude: 1 },
    ...frame,
  });

  return { pixels, fillStyles };
}
