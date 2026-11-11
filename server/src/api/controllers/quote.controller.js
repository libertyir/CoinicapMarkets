import { cached, json } from "./http.js";

export function latestQuotes(request, app) {
  const url = new URL(request.url);
  return cached(request, () => app.quotes.latest({
    exchange: url.searchParams.get("exchange"),
    market: url.searchParams.get("market"),
    timeframe: url.searchParams.get("timeframe"),
  }));
}

export async function quoteSeries(request, app) {
  const url = new URL(request.url);
  try {
    return await cached(request, () => app.quotes.series({
      exchange: url.searchParams.get("exchange"),
      market: url.searchParams.get("market"),
      timeframe: url.searchParams.get("timeframe"),
      from: Number(url.searchParams.get("from")),
      to: Number(url.searchParams.get("to")),
    }));
  } catch (error) {
    return json({ error: error.code || "internal_error", message: error.message }, error.status || 500);
  }
}
