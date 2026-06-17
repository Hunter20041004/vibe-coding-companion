import { AGENT_STATES } from "./agent-state.js";
import { requestGoogleText } from "./structured-ai-provider.js";

const DEFAULT_GOOGLE_MODEL = "gemma-4-31b-it";
const SAFE_ZONES = ["right-edge", "top-right", "bottom-right", "retreat"];

export function createVisionAnalyzerFromEnv(env = process.env, options = {}) {
  const provider = String(env.AI_PROVIDER ?? "").toLowerCase();

  if (provider === "google" || env.GEMINI_API_KEY || env.GOOGLE_API_KEY) {
    return createGoogleVisionContextAnalyzer({
      apiKey: env.AI_API_KEY ?? env.GEMINI_API_KEY ?? env.GOOGLE_API_KEY,
      model: env.VISION_MODEL ?? env.AI_MODEL ?? env.GEMINI_MODEL ?? DEFAULT_GOOGLE_MODEL,
      ...options,
    });
  }

  return null;
}

export function createGoogleVisionContextAnalyzer({
  apiKey,
  model = DEFAULT_GOOGLE_MODEL,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiKey) {
    return null;
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("createGoogleVisionContextAnalyzer requires fetchImpl.");
  }

  return async function analyzeVisionContext({ imageDataUrl } = {}) {
    const image = parseImageDataUrl(imageDataUrl);
    if (!image) return null;

    const text = await requestGoogleText({
      apiKey,
      model,
      fetchImpl,
      body: createGoogleVisionRequestBody({ image }),
    });
    if (!text) return null;
    const context = normalizeVisionContext(text);
    if (context) return context;

    return (
      (await repairGoogleVisionContext({ apiKey, model, fetchImpl, text })) ??
      createUnclearVisionContext(text)
    );
  };
}

export function parseImageDataUrl(imageDataUrl) {
  const match = String(imageDataUrl ?? "").match(
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/
  );

  if (!match) return null;

  return {
    mimeType: match[1],
    data: match[2],
  };
}

function createGoogleVisionRequestBody({ image }) {
  return {
    systemInstruction: {
      parts: [
        {
          text:
            "You analyze one user-approved screenshot from a local coding companion tool. Return only JSON. Do not reveal secrets, credentials, or private text verbatim. Summarize the visible coding workflow state.",
        },
      ],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "Return JSON with activity, suggestedState, confidence, visibleSignals, and safeZone.",
              `Valid suggestedState values: ${AGENT_STATES.join(", ")}.`,
              `Valid safeZone values: ${SAFE_ZONES.join(", ")}.`,
              "Use retreat when the screenshot is too dense or no safe placement is clear.",
            ].join("\n"),
          },
          {
            inlineData: image,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
    },
  };
}

async function repairGoogleVisionContext({ apiKey, model, fetchImpl, text }) {
  if (!text) return null;

  const repairedText = await requestGoogleText({
    apiKey,
    model,
    fetchImpl,
    body: createGoogleVisionRepairBody({ text }),
  });

  return normalizeVisionContext(repairedText);
}

function createGoogleVisionRepairBody({ text }) {
  return {
    systemInstruction: {
      parts: [
        {
          text:
            "Convert a previous vision-model answer into one JSON object. Return only JSON. Do not add new private details. If the answer is ambiguous, use suggestedState waiting and low confidence.",
        },
      ],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "Extract JSON with activity, suggestedState, confidence, visibleSignals, and safeZone.",
              `Valid suggestedState values: ${AGENT_STATES.join(", ")}.`,
              `Valid safeZone values: ${SAFE_ZONES.join(", ")}.`,
              "Previous answer:",
              String(text).slice(0, 2000),
            ].join("\n"),
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
    },
  };
}

function createUnclearVisionContext(text) {
  if (!text) return null;

  return {
    activity: "No clear coding activity detected.",
    suggestedState: "waiting",
    confidence: 0,
    visibleSignals: [],
  };
}

function normalizeVisionContext(text) {
  if (!text) return null;

  const parsed = parseProviderJsonObject(text);
  if (!parsed) return null;

  const suggestedState = AGENT_STATES.includes(parsed.suggestedState)
    ? parsed.suggestedState
    : "waiting";
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
  const visibleSignals = Array.isArray(parsed.visibleSignals)
    ? parsed.visibleSignals.map((signal) => String(signal).slice(0, 80)).slice(0, 6)
    : [];
  const safeZone = normalizeSafeZone(parsed.safeZone);

  return {
    activity: String(parsed.activity ?? "").slice(0, 180),
    suggestedState,
    confidence,
    visibleSignals,
    ...(safeZone ? { safeZone } : {}),
  };
}

function normalizeSafeZone(safeZone) {
  const value = String(safeZone ?? "").trim();
  return SAFE_ZONES.includes(value) ? value : "";
}

function parseProviderJsonObject(text) {
  const source = String(text).trim();

  try {
    return JSON.parse(source);
  } catch {
    return parseFirstJsonObject(source) ?? parseLabeledVisionObject(source);
  }
}

function parseFirstJsonObject(source) {
  for (
    let start = source.indexOf("{");
    start !== -1;
    start = source.indexOf("{", start + 1)
  ) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < source.length; index += 1) {
      const char = source[index];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = inString;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(source.slice(start, index + 1));
          } catch {
            break;
          }
        }
      }
    }
  }

  return null;
}

function parseLabeledVisionObject(source) {
  const activity = parseLabeledString(readLastLabel(source, ["activity"]));
  const suggestedState = parseLabeledString(
    readLastLabel(source, ["suggestedState", "suggested\\s+state"])
  );
  const confidence = parseLabeledNumber(readLastLabel(source, ["confidence"]));
  const visibleSignals = parseLabeledArray(
    readLastLabel(source, ["visibleSignals", "visible\\s+signals"])
  );
  const safeZone = parseLabeledString(
    readLastLabel(source, ["safeZone", "safe\\s+zone"])
  );

  if (
    !activity &&
    !suggestedState &&
    confidence === null &&
    !visibleSignals &&
    !safeZone
  ) {
    return null;
  }

  return {
    activity,
    suggestedState,
    confidence,
    visibleSignals: visibleSignals ?? [],
    safeZone,
  };
}

function readLastLabel(source, labels) {
  const pattern = new RegExp(
    `(?:^|\\n)\\s*(?:[-*]\\s*)?(?:${labels.join("|")})\\s*:\\s*([^\\n]+)`,
    "gi"
  );
  let value;

  for (const match of source.matchAll(pattern)) {
    value = match[1]?.trim();
  }

  return value;
}

function parseLabeledString(rawValue) {
  if (!rawValue) return "";
  const quotedValue = rawValue.match(/"([^"]*)"/)?.[1];
  if (quotedValue !== undefined) return quotedValue.trim();

  return rawValue
    .replace(/\s+or\s+.*$/i, "")
    .replace(/[.;,]$/g, "")
    .trim();
}

function parseLabeledNumber(rawValue) {
  if (!rawValue) return null;
  const match = rawValue.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseLabeledArray(rawValue) {
  if (!rawValue) return null;
  const arrayLiteral = rawValue.match(/\[[^\]]*\]/)?.[0];

  if (arrayLiteral) {
    try {
      const parsed = JSON.parse(arrayLiteral.replaceAll("'", '"'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  const quotedValues = [...rawValue.matchAll(/"([^"]+)"/g)].map(
    (match) => match[1]
  );
  if (quotedValues.length > 0) return quotedValues;

  const cleaned = rawValue.replace(/[.;,]$/g, "").trim();
  if (!cleaned || /^(none|empty|n\/a)$/i.test(cleaned)) return [];
  return [cleaned];
}
