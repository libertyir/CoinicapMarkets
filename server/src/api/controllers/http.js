import { cachedJson } from "../../cache/response-cache.js";

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function cached(request, load) {
  return cachedJson(request, load);
}
