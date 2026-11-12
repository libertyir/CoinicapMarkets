import { createApplication } from "../application/container.js";
import { ApplicationError } from "../domain/errors/application-error.js";
import { json } from "./controllers/http.js";
import { listExchanges } from "./controllers/exchange.controller.js";
import { listAssets, listPairs, listTimeframes, listExchangePairs } from "./controllers/market.controller.js";
import { latestQuotes, quoteSeries } from "./controllers/quote.controller.js";
import { latestAggregates, aggregateSeries } from "./controllers/aggregate.controller.js";
import { chartConfig, chartSymbols, chartSearch, chartHistory } from "./controllers/chart.controller.js";
import { bootstrapAdmin, login, listPolicies, updatePolicy, createAccount, listUsers, listTokens, revokeToken } from "./controllers/access.controller.js";
import { importHistoryJson } from "./controllers/history-sync.controller.js";

function accessKey(path) {
  const fixed={"/api/v1/exchanges":"exchanges.list","/api/v1/assets":"assets.list",
    "/api/v1/markets":"markets.list","/api/v1/exchange-markets":"exchange-markets.list",
    "/api/v1/timeframes":"timeframes.list","/api/v1/quotes/latest":"quotes.latest",
    "/api/v1/quotes/series":"quotes.series","/api/v1/aggregates/latest":"aggregates.latest",
    "/api/v1/aggregates/series":"aggregates.series","/api/v1/indices":"indices.list",
    "/api/v1/charting/config":"charting.config","/api/v1/charting/search":"charting.search",
    "/api/v1/charting/symbols":"charting.symbols","/api/v1/charting/history":"charting.history"};
  if (fixed[path]) return fixed[path];
  const parts=path.split("/").filter(Boolean);
  if (parts[2]==="indices" && parts.length>=4)
    return `indices.${parts[4]||"latest"}`;
  if (path.startsWith("/api/v1/estimates/")) {
    const suffix=path.split("/").at(-1);
    return suffix==="components"?"indices.components":suffix==="exchanges"?"indices.exchanges":"indices.latest";
  }
  return null;
}
import {
  listIndexes, latestIndex, indexComponents, indexExchanges, indexSeries,
} from "./controllers/index.controller.js";

async function dispatch(request, app, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/health") return json({ ok: true });
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (path === "/api/v1/auth/bootstrap" && request.method === "POST") return bootstrapAdmin(request,app,env);
  if (path === "/api/v1/auth/login" && request.method === "POST") return login(request,app);
  if (path === "/api/v1/admin/access-policies" || path.startsWith("/api/v1/admin/access-policies/")) {
    const user=await app.access.authenticate(request);
    if (user?.role!=="admin") return json({error:"admin_required"},user?403:401);
    if (path==="/api/v1/admin/access-policies" && request.method==="GET") return listPolicies(app);
    const match=path.match(/^\/api\/v1\/admin\/access-policies\/([a-z0-9.-]+)$/);
    if (match && request.method==="PATCH") return updatePolicy(request,app,match[1],user);
    return json({error:"not_found"},404);
  }
  if (path==="/api/v1/admin/users") {
    const user=await app.access.authenticate(request);
    if (user?.role!=="admin") return json({error:"admin_required"},user?403:401);
    if (request.method==="GET") return listUsers(app);
    if (request.method==="POST") return createAccount(request,app);
    return json({error:"method_not_allowed"},405);
  }
  if (path==="/api/v1/admin/tokens" && request.method==="GET") {
    const user=await app.access.authenticate(request);
    if (user?.role!=="admin") return json({error:"admin_required"},user?403:401);
    return listTokens(app);
  }
  if (path==="/api/v1/admin/history-sync/import-json" && request.method==="POST") {
    const user=await app.access.authenticate(request);
    if (user?.role!=="admin") return json({error:"admin_required"},user?403:401);
    return importHistoryJson(request,app);
  }
  const revokeMatch=path.match(/^\/api\/v1\/admin\/tokens\/(\d+)\/revoke$/);
  if (revokeMatch) {
    const user=await app.access.authenticate(request);
    if (user?.role!=="admin") return json({error:"admin_required"},user?403:401);
    if (request.method==="POST") return revokeToken(app,revokeMatch[1]);
  }
  if (request.method!=="GET") return json({error:"method_not_allowed"},405);
  const key=accessKey(path);
  if (key) {
    const policy=await app.accessRepository.policy(key);
    if (!policy || !policy.enabled) return json({error:"route_disabled"},404);
    if (!policy.is_public) {
      const user=await app.access.authenticate(request);
      if (!user) return json({error:"authentication_required"},401);
      if (!user.scopes.includes("read") && user.role!=="admin") return json({error:"read_scope_required"},403);
    }
  }

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
    const app=createApplication(env);
    response = await dispatch(request, app, env);
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
