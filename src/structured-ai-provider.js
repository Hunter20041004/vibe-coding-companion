export const GOOGLE_GENERATE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

export function createGoogleGenerateUrl(model) {
  return `${GOOGLE_GENERATE_URL}/${encodeURIComponent(model)}:generateContent`;
}

export function extractGoogleText(payload = {}) {
  return payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .find(Boolean);
}

export async function requestGoogleText({
  apiKey,
  model,
  fetchImpl = globalThis.fetch,
  body,
} = {}) {
  const response = await fetchImpl(createGoogleGenerateUrl(model), {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return null;
  }

  return extractGoogleText(await response.json()) ?? null;
}

export function createGoogleJsonRequester({
  apiKey,
  model,
  fetchImpl = globalThis.fetch,
  createBody,
  createFallbackBody = null,
  normalizeJson = (json) => json,
} = {}) {
  if (!apiKey) {
    return null;
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("createGoogleJsonRequester requires fetchImpl.");
  }

  return async function requestGoogleJson(context = {}) {
    let text = await requestGoogleText({
      apiKey,
      model,
      fetchImpl,
      body: createBody(context),
    });

    if (!text && createFallbackBody) {
      text = await requestGoogleText({
        apiKey,
        model,
        fetchImpl,
        body: createFallbackBody(context),
      });
    }

    if (!text) return null;
    return normalizeJson(JSON.parse(text));
  };
}
