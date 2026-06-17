import { describe, expect, it, vi } from "vitest";
import { createGoogleVisionContextAnalyzer } from "../src/vision-context.js";

describe("Vision context analyzer", () => {
  it("asks Google AI Studio to summarize a one-shot screenshot without storing it", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    activity: "Reviewing a failed test result in Codex.",
                    suggestedState: "error",
                    confidence: 0.82,
                    visibleSignals: ["failed test output", "Codex window"],
                  }),
                },
              ],
            },
          },
        ],
      }),
    }));
    const analyze = createGoogleVisionContextAnalyzer({
      apiKey: "google-test-key",
      model: "gemma-4-31b-it",
      fetchImpl,
    });

    await expect(
      analyze({
        imageDataUrl: "data:image/png;base64,ZmFrZS1wbmc=",
      })
    ).resolves.toEqual({
      activity: "Reviewing a failed test result in Codex.",
      suggestedState: "error",
      confidence: 0.82,
      visibleSignals: ["failed test output", "Codex window"],
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-goog-api-key": "google-test-key",
          "content-type": "application/json",
        }),
      })
    );

    const [, request] = fetchImpl.mock.calls[0];
    const body = JSON.parse(request.body);
    expect(JSON.stringify(body)).toContain("one user-approved screenshot");
    expect(body.contents[0].parts[1]).toEqual({
      inlineData: {
        mimeType: "image/png",
        data: "ZmFrZS1wbmc=",
      },
    });
  });

  it("normalizes a JSON object embedded in provider prose", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text:
                    'JSON: `{"activity":"blank screen","suggestedState":"idle","confidence":0.4,"visibleSignals":["empty image"]}`',
                },
              ],
            },
          },
        ],
      }),
    }));
    const analyze = createGoogleVisionContextAnalyzer({
      apiKey: "google-test-key",
      model: "gemma-4-31b-it",
      fetchImpl,
    });

    await expect(
      analyze({
        imageDataUrl: "data:image/png;base64,ZmFrZS1wbmc=",
      })
    ).resolves.toEqual({
      activity: "blank screen",
      suggestedState: "idle",
      confidence: 0.4,
      visibleSignals: ["empty image"],
    });
  });

  it("keeps the placement safe zone from Google vision context", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    activity: "Codex is writing code near the lower input area.",
                    suggestedState: "coding",
                    confidence: 0.79,
                    visibleSignals: ["active editor", "bottom input composer"],
                    safeZone: "top-right",
                  }),
                },
              ],
            },
          },
        ],
      }),
    }));
    const analyze = createGoogleVisionContextAnalyzer({
      apiKey: "google-test-key",
      model: "gemma-4-31b-it",
      fetchImpl,
    });

    await expect(
      analyze({
        imageDataUrl: "data:image/png;base64,ZmFrZS1wbmc=",
      })
    ).resolves.toEqual({
      activity: "Codex is writing code near the lower input area.",
      suggestedState: "coding",
      confidence: 0.79,
      visibleSignals: ["active editor", "bottom input composer"],
      safeZone: "top-right",
    });
  });

  it("normalizes provider bullet labels when Gemma does not emit JSON", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: [
                    "The image is a blank white square.",
                    '- activity: "None" or "Inactive"',
                    '- suggestedState: "idle"',
                    "- confidence: 1.0",
                    "- visibleSignals: []",
                  ].join("\n"),
                },
              ],
            },
          },
        ],
      }),
    }));
    const analyze = createGoogleVisionContextAnalyzer({
      apiKey: "google-test-key",
      model: "gemma-4-31b-it",
      fetchImpl,
    });

    await expect(
      analyze({
        imageDataUrl: "data:image/png;base64,ZmFrZS1wbmc=",
      })
    ).resolves.toEqual({
      activity: "None",
      suggestedState: "idle",
      confidence: 1,
      visibleSignals: [],
    });
  });

  it("prefers labeled conclusions over schema descriptions in provider prose", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: [
                    "JSON structure:",
                    "- activity: string (summary)",
                    "- suggestedState: one of the predefined values",
                    "- confidence: number (0 to 1)",
                    "- visibleSignals: array of strings",
                    "",
                    "Plan:",
                    '- Activity: "No activity detected"',
                    '- suggestedState: "idle"',
                    "- confidence: 1.0",
                    "- visibleSignals: []",
                  ].join("\n"),
                },
              ],
            },
          },
        ],
      }),
    }));
    const analyze = createGoogleVisionContextAnalyzer({
      apiKey: "google-test-key",
      model: "gemma-4-31b-it",
      fetchImpl,
    });

    await expect(
      analyze({
        imageDataUrl: "data:image/png;base64,ZmFrZS1wbmc=",
      })
    ).resolves.toEqual({
      activity: "No activity detected",
      suggestedState: "idle",
      confidence: 1,
      visibleSignals: [],
    });
  });

  it("repairs unstructured provider prose without resending the screenshot", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text:
                      "The screen is too ambiguous to produce the requested object.",
                  },
                ],
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      activity: "Unable to identify a clear coding activity.",
                      suggestedState: "waiting",
                      confidence: 0.2,
                      visibleSignals: ["ambiguous screenshot"],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });
    const analyze = createGoogleVisionContextAnalyzer({
      apiKey: "google-test-key",
      model: "gemma-4-31b-it",
      fetchImpl,
    });

    await expect(
      analyze({
        imageDataUrl: "data:image/png;base64,ZmFrZS1wbmc=",
      })
    ).resolves.toEqual({
      activity: "Unable to identify a clear coding activity.",
      suggestedState: "waiting",
      confidence: 0.2,
      visibleSignals: ["ambiguous screenshot"],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const repairBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(JSON.stringify(repairBody)).not.toContain("inlineData");
    expect(JSON.stringify(repairBody)).toContain(
      "The screen is too ambiguous"
    );
  });

  it("falls back to a low-confidence waiting context when provider prose cannot be repaired", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "I cannot produce the requested object." }],
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "Still no structured output." }],
              },
            },
          ],
        }),
      });
    const analyze = createGoogleVisionContextAnalyzer({
      apiKey: "google-test-key",
      model: "gemma-4-31b-it",
      fetchImpl,
    });

    await expect(
      analyze({
        imageDataUrl: "data:image/png;base64,ZmFrZS1wbmc=",
      })
    ).resolves.toEqual({
      activity: "No clear coding activity detected.",
      suggestedState: "waiting",
      confidence: 0,
      visibleSignals: [],
    });
  });
});
