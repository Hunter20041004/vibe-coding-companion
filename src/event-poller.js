export function createEventPoller({
  eventUrl,
  onEvent,
  fetchImpl = globalThis.fetch,
  intervalMs = 1000,
}) {
  if (!eventUrl) {
    throw new Error("createEventPoller requires eventUrl.");
  }

  if (typeof onEvent !== "function") {
    throw new Error("createEventPoller requires onEvent.");
  }

  let cursor = 0;
  let timer = 0;

  const pollOnce = async () => {
    const url = `${eventUrl}?since=${cursor}`;
    let response;

    try {
      response = await fetchImpl(url);
    } catch {
      return;
    }

    if (!response.ok) {
      return;
    }

    const payload = await response.json();

    for (const item of payload.events ?? []) {
      onEvent(item.event);
      cursor = Math.max(cursor, item.id);
    }
  };

  return {
    pollOnce,
    start() {
      if (timer) {
        return;
      }

      timer = setInterval(pollOnce, intervalMs);
      void pollOnce();
    },
    stop() {
      if (!timer) {
        return;
      }

      clearInterval(timer);
      timer = 0;
    },
    cursor() {
      return cursor;
    },
  };
}
