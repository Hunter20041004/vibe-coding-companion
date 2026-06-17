import { AGENT_STATES } from "./agent-state.js";
import { createGoogleJsonRequester } from "./structured-ai-provider.js";

const DEFAULT_OPENAI_MODEL = "gpt-5.5";
const DEFAULT_GOOGLE_MODEL = "gemma-4-31b-it";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const INTENSITIES = ["low", "medium", "high"];
const MOTIONS = ["observe", "wander", "work", "panic", "celebrate"];

const COMPANION_DECISION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    state: {
      type: "string",
      enum: AGENT_STATES,
      description: "Best companion state for the current coding moment.",
    },
    intensity: {
      type: "string",
      enum: INTENSITIES,
      description: "How strongly the sprite should react.",
    },
    motion: {
      type: "string",
      enum: MOTIONS,
      description: "Short motion family for the sprite.",
    },
    line: {
      type: "string",
      description:
        "One short, playful English status line. Do not shame the user or code author.",
    },
  },
  required: ["state", "intensity", "motion", "line"],
};

export function createOpenAiCompanionClassifierFromEnv(
  env = process.env,
  options = {}
) {
  const apiKey = env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  return createOpenAiCompanionClassifier({
    apiKey,
    model: env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
    ...options,
  });
}

export function createCompanionClassifierFromEnv(
  env = process.env,
  options = {}
) {
  const provider = String(env.AI_PROVIDER ?? "").toLowerCase();

  if (provider === "google" || env.GEMINI_API_KEY || env.GOOGLE_API_KEY) {
    return createGoogleAiCompanionClassifier({
      apiKey: env.AI_API_KEY ?? env.GEMINI_API_KEY ?? env.GOOGLE_API_KEY,
      model: env.AI_MODEL ?? env.GEMINI_MODEL ?? DEFAULT_GOOGLE_MODEL,
      ...options,
    });
  }

  if (provider === "openai" || env.OPENAI_API_KEY) {
    return createOpenAiCompanionClassifier({
      apiKey: env.AI_API_KEY ?? env.OPENAI_API_KEY,
      model: env.AI_MODEL ?? env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
      ...options,
    });
  }

  return null;
}

export function createOpenAiCompanionClassifier({
  apiKey,
  model = DEFAULT_OPENAI_MODEL,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiKey) {
    return null;
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("createOpenAiCompanionClassifier requires fetchImpl.");
  }

  return async function classifyCompanionEvent(context = {}) {
    const response = await fetchImpl(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(createRequestBody({ model, context })),
    });

    if (!response.ok) {
      return null;
    }

    return normalizeDecision(extractDecision(await response.json()));
  };
}

export function createGoogleAiCompanionClassifier({
  apiKey,
  model = DEFAULT_GOOGLE_MODEL,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiKey) {
    return null;
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("createGoogleAiCompanionClassifier requires fetchImpl.");
  }

  return createGoogleJsonRequester({
    apiKey,
    model,
    fetchImpl,
    createBody: (context) => createGoogleRequestBody({ context }),
    createFallbackBody: (context) => createGoogleFallbackRequestBody({ context }),
    normalizeJson: normalizeDecision,
  });
}

function createRequestBody({ model, context }) {
  return {
    model,
    input: [
      {
        role: "system",
        content:
          "You classify a coding companion sprite's next reaction from local coding-agent events. Return only the structured decision. Be playful, concise, and never insult the user or code author.",
      },
      {
        role: "user",
        content: JSON.stringify({
          fallbackState: context.fallbackState ?? "waiting",
          event: context.event ?? {},
          recentEvents: context.recentEvents ?? [],
        }),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "companion_decision",
        strict: true,
        schema: COMPANION_DECISION_SCHEMA,
      },
    },
  };
}

function createGoogleRequestBody({ context }) {
  return {
    systemInstruction: {
      parts: [
        {
          text:
            "You classify a coding companion sprite's next reaction from local coding-agent events. Return only the structured decision. Be playful, concise, and never insult the user or code author.",
        },
      ],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: JSON.stringify({
              fallbackState: context.fallbackState ?? "waiting",
              event: context.event ?? {},
              recentEvents: context.recentEvents ?? [],
            }),
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: createGoogleResponseSchema(COMPANION_DECISION_SCHEMA),
    },
  };
}

function createGoogleFallbackRequestBody({ context }) {
  return {
    systemInstruction: {
      parts: [
        {
          text:
            "You classify a coding companion sprite's next reaction from local coding-agent events. Return only JSON with keys state, intensity, motion, and line. Do not wrap it in markdown. Be playful, concise, and never insult the user or code author.",
        },
      ],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Return only JSON for this context: ${JSON.stringify({
              fallbackState: context.fallbackState ?? "waiting",
              event: context.event ?? {},
              recentEvents: context.recentEvents ?? [],
              validStates: AGENT_STATES,
              validIntensities: INTENSITIES,
              validMotions: MOTIONS,
            })}`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
    },
  };
}

function createGoogleResponseSchema(schema) {
  if (Array.isArray(schema)) {
    return schema.map(createGoogleResponseSchema);
  }

  if (!schema || typeof schema !== "object") {
    return schema;
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "additionalProperties") continue;
    cleaned[key] = createGoogleResponseSchema(value);
  }
  return cleaned;
}

function extractDecision(payload = {}) {
  if (payload.output_parsed) {
    return payload.output_parsed;
  }

  if (payload.output_text) {
    return JSON.parse(payload.output_text);
  }

  const text = payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .find(Boolean);

  return text ? JSON.parse(text) : null;
}

function normalizeDecision(decision) {
  if (!decision || !AGENT_STATES.includes(decision.state)) {
    return null;
  }

  return {
    state: decision.state,
    intensity: INTENSITIES.includes(decision.intensity)
      ? decision.intensity
      : "medium",
    motion: MOTIONS.includes(decision.motion) ? decision.motion : "observe",
    line: String(decision.line ?? "").slice(0, 120),
  };
}
