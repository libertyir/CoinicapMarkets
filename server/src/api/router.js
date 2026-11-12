import { createApplication } from "../application/container.js";
import { ApplicationError } from "../domain/errors/application-error.js";
import { json } from "./controllers/http.js";
import { listExchanges } from "./controllers/exchange.controller.js";
import { listAssets, listPairs, listTimeframes, listExchangePairs } from "./controllers/market.controller.js";
import { latestQuotes, quoteSeries } from "./controllers/quote.controller.js";
import { latestAggregates, aggregateSeries } from "./controllers/aggregate.controller.js";
import { chartConfig, chartSymbols, chartSearch, chartHistory } from "./controllers/chart.controller.js";
import {
  listIndexes, latestIndex, indexComponents, indexExchanges, indexSeries,
} from "./controllers/index.controller.js";

async function dispatch(request, app) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/health") return json({ ok: true });
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  if (path === "/api/v1/exchanges") return listExchanges(request, app);
  if (path === "/api/v1/assets") return listAssets(request, app);
  if (path === "/api/v1/markets") return listPairs(request, app);
  if (path === "/api/v1/exchange-markets") return listExchangePairs(request, app);
  if (path === "/api/v1/timeframes") return listTimeframes(request, app);
  if (path === "/api/v1/quotes/latest") return latestQuotes(request, app);
  if (path === "/api/v1/quotes/series") return quoteSeries(request, app);
  if (path === "/api/v1/aggregates/latest") return latestAggregates(request, app);
  if (path === "/api/v1/aggregates/series") return aggregateSeries(request, app);
  if (path === "/api/v1/charting/config") return chartConfig();
  if (path === "/api/v1/charting/symbols") return chartSymbols(request, app);
  if (path === "/api/v1/charting/search") return chartSearch(request, app);
  if (path === "/api/v1/charting/history") return chartHistory(request, app);

  const segments = path.split("/").filter(Boolean);
  if (path === "/api/v1/indices") return listIndexes(request, app);
  if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "indices" && segments[3]) {
    const code = decodeURIComponent(segments[3]);
    if (segments.length === 4) return latestIndex(request, app, code);
    if (segments.length === 5 && segments[4] === "components")
      return indexComponents(request, app, code);
    if (segments.length === 5 && segments[4] === "exchanges")
      return indexExchanges(request, app, code);
    if (segments.length === 5 && segments[4] === "series")
      return indexSeries(request, app, code);
  }

  if (path.startsWith("/api/v1/estimates/")) {
    const suffix = path.slice("/api/v1/estimates/".length);
    if (suffix === "usdt-tmn") return latestIndex(request, app, "USDTTMN");
    if (suffix === "usdt-tmn/components") return indexComponents(request, app, "USDTTMN");
    if (suffix === "usdt-tmn/exchanges") return indexExchanges(request, app, "USDTTMN");
  }
  return json({ error: "not_found" }, 404);
}

export async function route(request, env) {
  let response;
  try {
    response = await dispatch(request, createApplication(env));
  } catch (error) {
    if (!(error instanceof ApplicationError)) console.error("api request failed", error);
    response = json({ error: error.code || "internal_error", message: error.message || "Request failed" },
      error.status || 500);
  }
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, POST, PATCH, DELETE, OPTIONS");
  headers.set("access-control-allow-headers", "Content-Type, Authorization");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
