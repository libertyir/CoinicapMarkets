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
      const rows = await env.DB.prepare(`
        SELECT e.code, e.name, e.description, e.website_url, e.documentation_url,
               e.support_url, e.support_email, e.status_page_url, e.logo_url, e.country_code,
               e.display_order,
               (SELECT json_group_array(json_object(
                 'type', c.contact_type, 'label', c.label, 'value', c.value
               )) FROM exchange_contacts c WHERE c.exchange_id=e.id AND c.is_public=1) AS contacts_json
        FROM exchanges e WHERE e.enabled=1 ORDER BY e.display_order, e.code
      `).all();
      return rows.results.map(({ contacts_json, ...exchange }) => ({
        ...exchange,
        contacts: JSON.parse(contacts_json || "[]"),
      }));
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

  if (url.pathname === "/api/v1/timeframes") {
    return cachedJson(request, async () => {
      const exchange = url.searchParams.get("exchange");
      const market = url.searchParams.get("market");
      const rows = await env.DB.prepare(`
        SELECT DISTINCT tf.code, tf.duration_seconds, tf.display_order
        FROM timeframes tf
        JOIN exchange_market_timeframes emt ON emt.timeframe_id=tf.id AND emt.enabled=1
        JOIN exchange_markets em ON em.id=emt.exchange_market_id AND em.enabled=1
        JOIN exchanges e ON e.id=em.exchange_id AND e.enabled=1
        JOIN markets m ON m.id=em.market_id AND m.enabled=1
        WHERE tf.enabled=1 AND (? IS NULL OR e.code=?) AND (? IS NULL OR m.code=?)
        ORDER BY tf.display_order, tf.duration_seconds
      `).bind(exchange, exchange, market, market).all();
      return rows.results;
    });
  }

  if (url.pathname === "/api/v1/quotes/latest") {
    return cachedJson(request, async () => {
      const exchange = url.searchParams.get("exchange");
      const market = url.searchParams.get("market");
      const timeframe = url.searchParams.get("timeframe");
      const rows = await env.DB.prepare(`
        WITH ranked AS (
          SELECT s.*, ROW_NUMBER() OVER (
            PARTITION BY s.exchange_market_id, s.timeframe_id ORDER BY s.collected_at_ms DESC
          ) AS row_num
          FROM market_data_samples s
        )
        SELECT e.code AS exchange, e.name AS exchange_name, s.output_market_symbol AS market,
               s.native_symbol AS exchange_symbol, tf.code AS timeframe,
               b.code AS base_asset, q.code AS quote_asset, s.price,
               s.open_price, s.close_price, s.volume, s.top_price, s.low_price,
               s.source_interval_code, s.source_open_time_ms, s.source_close_time_ms,
               s.source_time_ms, s.collected_at_ms,
               (CAST(strftime('%s','now') AS INTEGER) * 1000 - s.collected_at_ms) AS age_ms
        FROM ranked s JOIN exchange_market_timeframes emt
          ON emt.exchange_market_id=s.exchange_market_id AND emt.timeframe_id=s.timeframe_id
        JOIN exchange_markets em ON em.id=s.exchange_market_id
        JOIN exchanges e ON e.id=em.exchange_id JOIN markets m ON m.id=em.market_id
        JOIN timeframes tf ON tf.id=s.timeframe_id
        JOIN assets b ON b.id=m.base_asset_id JOIN assets q ON q.id=m.quote_asset_id
        WHERE s.row_num=1 AND e.enabled=1 AND em.enabled=1 AND emt.enabled=1
          AND m.enabled=1 AND b.enabled=1 AND q.enabled=1 AND tf.enabled=1
          AND (? IS NULL OR e.code=?) AND (? IS NULL OR m.code=?) AND (? IS NULL OR tf.code=?)
        ORDER BY e.display_order, m.display_order, e.code, m.code, tf.duration_seconds
      `).bind(exchange, exchange, market, market, timeframe, timeframe).all();
      return rows.results;
    });
  }

  if (url.pathname === "/api/v1/quotes/series") {
    const exchange = url.searchParams.get("exchange");
    const market = url.searchParams.get("market");
    const timeframe = url.searchParams.get("timeframe");
    const from = Number(url.searchParams.get("from"));
    const to = Number(url.searchParams.get("to"));
    if (!exchange || !market || !timeframe || !Number.isFinite(from) || !Number.isFinite(to) || from > to || to - from > 90 * 86400000)
      return json({ error: "invalid_parameters", message: "exchange, market, timeframe, from and to are required; maximum range is 90 days" }, 400);
    return cachedJson(request, async () => {
      const rows = await env.DB.prepare(`
        SELECT e.code AS exchange, s.output_market_symbol AS market, s.native_symbol AS exchange_symbol,
               tf.code AS timeframe, s.price, s.open_price, s.close_price, s.volume,
               s.top_price, s.low_price, s.source_interval_code, s.source_open_time_ms,
               s.source_close_time_ms, s.source_time_ms, s.collected_at_ms
        FROM market_data_samples s JOIN exchange_market_timeframes emt
          ON emt.exchange_market_id=s.exchange_market_id AND emt.timeframe_id=s.timeframe_id
        JOIN exchange_markets em ON em.id=s.exchange_market_id
        JOIN exchanges e ON e.id=em.exchange_id JOIN markets m ON m.id=em.market_id
        JOIN timeframes tf ON tf.id=s.timeframe_id
        WHERE e.code=? AND m.code=? AND tf.code=? AND em.enabled=1 AND emt.enabled=1
          AND e.enabled=1 AND m.enabled=1 AND tf.enabled=1
          AND s.collected_at_ms BETWEEN ? AND ? ORDER BY s.collected_at_ms LIMIT 20000
      `).bind(exchange, market, timeframe, from, to).all();
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
