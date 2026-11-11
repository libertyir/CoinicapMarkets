import { cached, json } from "./http.js";

export function latestAggregates(request, app) {
  const url = new URL(request.url);
  return cached(request, () => app.aggregates.latest({
    market: url.searchParams.get("market"),
    timeframe: url.searchParams.get("timeframe"),
    type: url.searchParams.get("type"),
  }));
}

export async function aggregateSeries(request, app) {
  const url = new URL(request.url);
  try {
    return await cached(request, () => app.aggregates.series({
      market: url.searchParams.get("market"),
      timeframe: url.searchParams.get("timeframe"),
      type: url.searchParams.get("type"),
      from: Number(url.searchParams.get("from")),
      to: Number(url.searchParams.get("to")),
    }));
  } catch (error) {
    return json({ error: error.code || "internal_error", message: error.message }, error.status || 500);
  }
}
