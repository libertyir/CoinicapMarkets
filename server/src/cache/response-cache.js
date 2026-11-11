const TTL_SECONDS = 300;
const MAX_LOCAL_ENTRIES = 256;
const local = new Map<string, { expiresAt: number; response: Response }>();

function remember(key: string, response: Response, expiresAt: number): void {
  for (const [cachedKey, entry] of local) {
    if (entry.expiresAt <= Date.now()) local.delete(cachedKey);
  }
  if (local.size >= MAX_LOCAL_ENTRIES && !local.has(key)) {
    const oldestKey = local.keys().next().value;
    if (oldestKey) local.delete(oldestKey);
  }
  local.set(key, { expiresAt, response: response.clone() });
}

/** Best-effort isolate memory in front of Cloudflare's per-location Cache API. */
export async function cachedJson(request, load, ttlSeconds = TTL_SECONDS) {
  const key = new Request(new URL(request.url).toString(), { method: "GET" });
  const now = Date.now();
  const localEntry = local.get(key.url);
  if (localEntry && localEntry.expiresAt > now)
    return localEntry.response.clone();

  let edgeHit: Response | undefined;
  try {
    edgeHit = await caches.default.match(key);
  } catch {
    // A cache outage must not prevent the database-backed response.
  }
  if (edgeHit) {
    remember(key.url, edgeHit, now + ttlSeconds * 1000);
    return edgeHit;
  }

  const body = await load();
  const response = new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=0, s-maxage=${ttlSeconds}`,
      "x-data-cache": "miss",
    },
  });
  remember(key.url, response, now + ttlSeconds * 1000);
  try {
    await caches.default.put(key, response.clone());
  } catch {
    // The isolate-local copy remains usable until eviction or restart.
  }
  return response;
}
