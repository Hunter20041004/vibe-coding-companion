import { normalizeHookPayload } from "./hook-normalizer.js";

export async function normalizeAndEmitHook({
  provider,
  payload,
  eventUrl,
  fetchImpl = fetch,
  capturePayload,
}) {
  const event = normalizeHookPayload(provider, payload);

  if (capturePayload) {
    await capturePayload({ provider, payload, event });
  }

  if (!event) {
    return { emitted: false, event: null, id: null };
  }

  const response = await fetchImpl(eventUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    throw new Error(`Failed to emit hook event: HTTP ${response.status}`);
  }

  const result = await response.json();

  return { emitted: true, event, id: result.id };
}
