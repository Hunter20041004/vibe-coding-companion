import { describe, expect, it, vi } from "vitest";
import { createGoogleJsonRequester } from "../src/structured-ai-provider.js";

describe("Structured AI provider adapter", () => {
  it("keeps Google schema fallback behind one JSON requester interface", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '{"state":"testing"}' }],
              },
            },
          ],
        }),
      });
    const request = createGoogleJsonRequester({
      apiKey: "google-key",
      model: "gemma-test",
      fetchImpl,
      createBody: () => ({ generationConfig: { responseSchema: {} } }),
      createFallbackBody: () => ({ generationConfig: { responseMimeType: "application/json" } }),
      normalizeJson: (json) => json,
    });

    await expect(request({ event: { type: "tool:start" } })).resolves.toEqual({
      state: "testing",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][0]).toContain("/gemma-test:generateContent");
    expect(fetchImpl.mock.calls[1][1].body).toContain("application/json");
  });
});
