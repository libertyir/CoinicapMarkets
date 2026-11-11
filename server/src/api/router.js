import { cachedJson } from "../cache/response-cache.js";

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

async function routeApi(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/health") return json({ ok: true });
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  if (url.pathname === "/api/v1/exchanges") {
    return cachedJson(request, async () => {
      const rows = await env.DB.prepare(`SELECT code, name, display_order FROM exchanges WHERE enabled = 1 ORDER BY display_order, code`).all();
      return rows.results;
    });
  }

  if (url.pathname === "/api/v1/markets") {
    return cachedJson(request, async () => {
      const rows = await env.DB.prepare(`
        SELECT m.code, b.code AS base_asset, q.code AS quote_asset, m.display_order, m.price_precision
        FROM markets m JOIN assets b ON b.id=m.base_asset_id JOIN assets q ON q.id=m.quote_asset_id
        WHERE m.enabled=1 AND b.enabled=1 AND q.enabled=1 ORDER BY m.display_order, m.code
      `).all();
      return rows.results;
    });
  }

  if (url.pathname === "/api/v1/quotes/latest") {
    return cachedJson(request, async () => {
      const exchange = url.searchParams.get("exchange");
      const market = url.searchParams.get("market");
      const rows = await env.DB.prepare(`
        SELECT e.code AS exchange, e.name AS exchange_name, m.code AS market,
               b.code AS base_asset, q.code AS quote_asset, l.price,
               l.source_time_ms, l.collected_at_ms,
               (CAST(strftime('%s','now') AS INTEGER) * 1000 - l.collected_at_ms) AS age_ms
        FROM latest_quotes l JOIN exchange_markets em ON em.id=l.exchange_market_id
        JOIN exchanges e ON e.id=em.exchange_id JOIN markets m ON m.id=em.market_id
        JOIN assets b ON b.id=m.base_asset_id JOIN assets q ON q.id=m.quote_asset_id
        WHERE e.enabled=1 AND em.enabled=1 AND m.enabled=1 AND b.enabled=1 AND q.enabled=1
          AND (? IS NULL OR e.code=?) AND (? IS NULL OR m.code=?)
        ORDER BY e.display_order, m.display_order, e.code, m.code
      `).bind(exchange, exchange, market, market).all();
      return rows.results;
    });
  }

  if (url.pathname === "/api/v1/quotes/series") {
    const exchange = url.searchParams.get("exchange");
    const market = url.searchParams.get("market");
    const from = Number(url.searchParams.get("from"));
    const to = Number(url.searchParams.get("to"));
    if (!exchange || !market || !Number.isFinite(from) || !Number.isFinite(to) || from > to || to - from > 90 * 86400000)
      return json({ error: "invalid_parameters", message: "exchange, market, from and to are required; maximum range is 90 days" }, 400);
    return cachedJson(request, async () => {
      const rows = await env.DB.prepare(`
        SELECT e.code AS exchange, m.code AS market, o.price, o.source_time_ms, o.collected_at_ms
        FROM observations o JOIN exchange_markets em ON em.id=o.exchange_market_id
        JOIN exchanges e ON e.id=em.exchange_id JOIN markets m ON m.id=em.market_id
        WHERE e.code=? AND m.code=? AND em.enabled=1 AND e.enabled=1 AND m.enabled=1
          AND o.collected_at_ms BETWEEN ? AND ? ORDER BY o.collected_at_ms LIMIT 20000
      `).bind(exchange, market, from, to).all();
      return rows.results;
    });
  }

  if (url.pathname === "/api/v1/estimates/usdt-tmn") {
    return cachedJson(request, async () => ({
      status: "not_configured",
      message: "Estimate becomes available after exchange adapters and eligible cross-market inputs are configured.",
      direct_market: "USDTTMN",
      derived_from: ["BTCTMN/BTCUSDT", "ETHTMN/ETHUSDT", "BNBTMN/BNBUSDT", "TRXTMN/TRXUSDT"],
    }));
  }

  return json({ error: "not_found" }, 404);
}

export async function route(request, env) {
  const response = await routeApi(request, env);
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, OPTIONS");
  headers.set("access-control-allow-headers", "Content-Type");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
