import { cached, json } from "./http.js";

export function listIndexes(request, app) {
  return cached(request, () => app.indexes.list());
}

export function latestIndex(request, app, code) {
  const url = new URL(request.url);
  return cached(request, () => app.indexes.latest(code, {
    timeframe: url.searchParams.get("timeframe") || "5m",
    type: url.searchParams.get("type"),
    exchange: url.searchParams.get("exchange"),
  }));
}

export function indexComponents(request, app, code) {
  const url = new URL(request.url);
  return cached(request, () => app.indexes.components(
    code, url.searchParams.get("timeframe") || "5m", {
      type: url.searchParams.get("type"), exchange: url.searchParams.get("exchange"),
    }
  ));
}

export function indexExchanges(request, app, code) {
  const url = new URL(request.url);
  return cached(request, () => app.indexes.exchanges(code, url.searchParams.get("timeframe") || "5m"));
}

export async function indexSeries(request, app, code) {
  const url = new URL(request.url);
  try {
    return await cached(request, () => app.indexes.series(code, {
      timeframe: url.searchParams.get("timeframe") || "5m",
      type: url.searchParams.get("type"),
      exchange: url.searchParams.get("exchange"),
      from: Number(url.searchParams.get("from")),
      to: Number(url.searchParams.get("to")),
    }));
  } catch (error) {
    return json({ error: error.code || "internal_error", message: error.message }, error.status || 500);
  }
}
