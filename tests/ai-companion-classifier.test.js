import { describe, expect, it, vi } from "vitest";
import {
  createCompanionClassifierFromEnv,
  createGoogleAiCompanionClassifier,
  createOpenAiCompanionClassifier,
  createOpenAiCompanionClassifierFromEnv,
} from "../src/ai-companion-classifier.js";

describe("AI companion classifier", () => {
  it("requests a structured companion decision from OpenAI", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          state: "debugging",
          intensity: "high",
          motion: "panic",
          line: "Tests are being dramatic.",
        }),
      }),
    }));
    const classifyEvent = createOpenAiCompanionClassifier({
      apiKey: "test-key",
      model: "gpt-test",
      fetchImpl,
    });

    const decision = await classifyEvent({
      event: { type: "tool:finish", tool: "test", status: "failed" },
      recentEvents: [{ type: "tool:start", tool: "test" }],
      fallbackState: "error",
    });

    expect(decision).toEqual({
      state: "debugging",
      intensity: "high",
      motion: "panic",
      line: "Tests are being dramatic.",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer test-key",
          "content-type": "application/json",
        }),
      })
    );

    const [, request] = fetchImpl.mock.calls[0];
    const body = JSON.parse(request.body);

    expect(body.model).toBe("gpt-test");
    expect(body.text.format).toMatchObject({
      type: "json_schema",
      name: "companion_decision",
      strict: true,
    });
    expect(body.text.format.schema.properties.state.enum).toContain("debugging");
    expect(JSON.stringify(body.input)).toContain("fallbackState");
  });

  it("returns null when no OpenAI API key is configured", () => {
    expect(createOpenAiCompanionClassifierFromEnv({})).toBeNull();
  });

  it("requests a structured companion decision from Google AI Studio Gemma", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    state: "debugging",
                    intensity: "high",
                    motion: "panic",
                    line: "Tests are being dramatic.",
                  }),
                },
              ],
            },
          },
        ],
      }),
    }));
    const classifyEvent = createGoogleAiCompanionClassifier({
      apiKey: "google-test-key",
      model: "gemma-4-31b-it",
      fetchImpl,
    });

    const decision = await classifyEvent({
      event: { type: "tool:finish", tool: "test", status: "failed" },
      recentEvents: [{ type: "tool:start", tool: "test" }],
      fallbackState: "error",
    });

    expect(decision).toEqual({
      state: "debugging",
      intensity: "high",
      motion: "panic",
      line: "Tests are being dramatic.",
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

    expect(body.generationConfig).toMatchObject({
      responseMimeType: "application/json",
    });
    expect(body.generationConfig.responseSchema.properties.state.enum)
      .toContain("debugging");
    expect(body.generationConfig.responseSchema).not.toHaveProperty(
      "additionalProperties"
    );
    expect(JSON.stringify(body.contents)).toContain("fallbackState");
  });

  it("selects the Google AI Studio classifier from env", () => {
    expect(
      createCompanionClassifierFromEnv({
        AI_PROVIDER: "google",
        AI_API_KEY: "google-test-key",
        AI_MODEL: "gemma-4-31b-it",
      })
    ).toBeTypeOf("function");
  });

  it("retries Google AI Studio without responseSchema when structured output fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { status: "INTERNAL" } }),
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
                      state: "debugging",
                      intensity: "high",
                      motion: "panic",
                      line: "Schema-free retry worked.",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });
    const classifyEvent = createGoogleAiCompanionClassifier({
      apiKey: "google-test-key",
      model: "gemma-4-31b-it",
      fetchImpl,
    });

    await expect(
      classifyEvent({
        event: { type: "tool:finish", tool: "test", status: "failed" },
        recentEvents: [],
        fallbackState: "error",
      })
    ).resolves.toEqual({
      state: "debugging",
      intensity: "high",
      motion: "panic",
      line: "Schema-free retry worked.",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(retryBody.generationConfig.responseSchema).toBeUndefined();
    expect(JSON.stringify(retryBody)).toContain("Return only JSON");
  });

  it("defaults to Google AI Studio Gemma when GEMINI_API_KEY is configured", () => {
    expect(
      createCompanionClassifierFromEnv({
        GEMINI_API_KEY: "google-test-key",
      })
    ).toBeTypeOf("function");
  });
});
