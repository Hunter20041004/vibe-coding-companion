import { describe, expect, it, vi } from "vitest";
import { createEventPoller } from "../src/event-poller.js";

describe("Event poller", () => {
  it("fetches events since the last cursor and dispatches them in order", async () => {
    const dispatched = [];
    const fetchImpl = vi.fn(async (url) => {
      expect(url).toBe("http://127.0.0.1:5174/events?since=0");

      return {
        ok: true,
        json: async () => ({
          events: [
            { id: 1, event: { type: "tool:start", tool: "test" } },
            {
              id: 2,
              event: {
                type: "tool:finish",
                tool: "test",
                status: "failed",
              },
            },
          ],
        }),
      };
    });
    const poller = createEventPoller({
      eventUrl: "http://127.0.0.1:5174/events",
      fetchImpl,
      onEvent: (event) => dispatched.push(event),
    });

    await poller.pollOnce();

    expect(dispatched).toEqual([
      { type: "tool:start", tool: "test" },
      { type: "tool:finish", tool: "test", status: "failed" },
    ]);
    expect(poller.cursor()).toBe(2);
  });

  it("ignores temporary fetch failures without moving the cursor", async () => {
    const poller = createEventPoller({
      eventUrl: "http://127.0.0.1:5174/events",
      fetchImpl: async () => {
        throw new TypeError("fetch failed");
      },
      onEvent: () => {
        throw new Error("No event should dispatch on failed fetch.");
      },
    });

    await expect(poller.pollOnce()).resolves.toBeUndefined();
    expect(poller.cursor()).toBe(0);
  });
});
