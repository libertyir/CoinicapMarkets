import { cachedJson } from "../cache/response-cache.js";
import { percentageGap } from "../calculations/decimal.js";

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
        SELECT e.code, e.name, e.name_fa, e.name_en, e.exchange_type,
               e.description, e.description_fa, e.description_en, e.website_url, e.documentation_url,
               e.support_url, e.support_email, e.status_page_url, e.logo_url, e.country_code,
               e.display_order,
               (SELECT json_group_array(json_object(
                 'type', c.contact_type, 'label', c.label,
                 'label_fa', c.label_fa, 'label_en', c.label_en, 'value', c.value
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
        SELECT m.code, m.display_name_fa, m.display_name_en,
               b.code AS base_asset, b.name_fa AS base_name_fa, b.name_en AS base_name_en,
               q.code AS quote_asset, q.name_fa AS quote_name_fa, q.name_en AS quote_name_en,
               m.display_order, m.price_precision
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
        SELECT e.code AS exchange, e.name AS exchange_name, e.name_fa AS exchange_name_fa,
               e.name_en AS exchange_name_en, e.exchange_type,
               s.output_market_symbol AS market,
               s.native_symbol AS exchange_symbol, tf.code AS timeframe,
               b.code AS base_asset, q.code AS quote_asset, s.price,
               s.open_price, s.close_price, s.volume, s.value, s.top_price, s.low_price,
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
        SELECT e.code AS exchange, e.name_fa AS exchange_name_fa,
               e.name_en AS exchange_name_en, e.exchange_type,
               s.output_market_symbol AS market, s.native_symbol AS exchange_symbol,
               tf.code AS timeframe, s.price, s.open_price, s.close_price, s.volume, s.value,
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

  if (url.pathname === "/api/v1/aggregates/latest") {
    return cachedJson(request, async () => {
      const market = url.searchParams.get("market");
      const timeframe = url.searchParams.get("timeframe");
      const type = url.searchParams.get("type");
      const rows = await env.DB.prepare(`
        WITH ranked AS (
          SELECT c.*, m.code AS market, tf.code AS timeframe,
                 ROW_NUMBER() OVER (PARTITION BY c.scope_type, c.scope_key, c.market_id, c.timeframe_id
                                    ORDER BY c.calculated_at_ms DESC) AS row_num
          FROM computed_market_samples c
          JOIN markets m ON m.id=c.market_id JOIN timeframes tf ON tf.id=c.timeframe_id
          WHERE (? IS NULL OR m.code=?) AND (? IS NULL OR tf.code=?)
            AND ((? IS NULL AND c.scope_type='all') OR c.scope_type='exchange_type')
            AND (? IS NULL OR c.scope_key=?)
        )
        SELECT scope_type, scope_key, market, timeframe, calculated_at_ms,
               price, open_price, close_price, high_price, low_price, volume, value,
               exchange_count, source_oldest_at_ms, source_newest_at_ms
        FROM ranked WHERE row_num=1 ORDER BY market, timeframe, scope_key
      `).bind(market, market, timeframe, timeframe, type, type, type).all();
      return rows.results;
    });
  }

  if (url.pathname === "/api/v1/estimates/usdt-tmn") {
    return cachedJson(request, async () => {
      const timeframe = url.searchParams.get("timeframe") || "5m";
      const type = url.searchParams.get("type");
      const exchange = url.searchParams.get("exchange");
      const scopeType = exchange ? "exchange" : type ? "exchange_type" : "all";
      const scopeKey = exchange || type || "all";
      const index = await env.DB.prepare(`
        SELECT i.scope_type, i.scope_key, tf.code AS timeframe, i.calculated_at_ms,
               i.price, i.open_price, i.close_price, i.high_price, i.low_price, i.value,
               i.exchange_count, i.asset_count, i.source_oldest_at_ms, i.source_newest_at_ms
        FROM usdt_index_samples i JOIN timeframes tf ON tf.id=i.timeframe_id
        WHERE i.scope_type=? AND i.scope_key=? AND tf.code=?
        ORDER BY i.calculated_at_ms DESC LIMIT 1
      `).bind(scopeType, scopeKey, timeframe).first();
      const direct = await env.DB.prepare(`
        SELECT c.price, c.open_price, c.close_price, c.high_price, c.low_price,
               c.value, c.exchange_count, c.calculated_at_ms
        FROM computed_market_samples c JOIN markets m ON m.id=c.market_id
        JOIN timeframes tf ON tf.id=c.timeframe_id
        WHERE c.scope_type=? AND c.scope_key=? AND m.code='USDTTMN' AND tf.code=?
        ORDER BY c.calculated_at_ms DESC LIMIT 1
      `).bind(scopeType, scopeKey, timeframe).first();
      return {
        status: index ? "available" : "no_data",
        method: "arithmetic_mean_of_coin_implied_rates",
        formula_version: "implied-usdt-tmn-v1",
        scope_type: scopeType, scope: scopeKey, timeframe,
        index, direct_usdt_tmn: direct,
        gap_percent: percentageGap(index?.price, direct?.price),
        quality_flags: [!index && "no_fresh_components", !direct && "no_direct_usdt_tmn"]
          .filter(Boolean),
        inputs: ["BTCTMN/BTCUSDT", "ETHTMN/ETHUSDT", "BNBTMN/BNBUSDT", "TRXTMN/TRXUSDT"],
      };
    });
  }

  if (url.pathname === "/api/v1/estimates/usdt-tmn/components") {
    return cachedJson(request, async () => {
      const timeframe = url.searchParams.get("timeframe") || "5m";
      const type = url.searchParams.get("type");
      const exchange = url.searchParams.get("exchange");
      const rows = await env.DB.prepare(`
        WITH ranked AS (
          SELECT c.*, e.code AS exchange, e.name_fa AS exchange_name_fa,
                 e.name_en AS exchange_name_en, e.exchange_type, a.code AS asset,
                 tf.code AS timeframe, tmn.collected_at_ms AS toman_collected_at_ms,
                 usd.collected_at_ms AS usdt_collected_at_ms,
                 ROW_NUMBER() OVER (PARTITION BY c.exchange_id, c.asset_id, c.timeframe_id
                                    ORDER BY c.calculated_at_ms DESC) AS row_num
          FROM usdt_index_component_samples c
          JOIN exchanges e ON e.id=c.exchange_id JOIN assets a ON a.id=c.asset_id
          JOIN timeframes tf ON tf.id=c.timeframe_id
          JOIN market_data_samples tmn ON tmn.id=c.toman_sample_id
          JOIN market_data_samples usd ON usd.id=c.usdt_sample_id
          WHERE tf.code=? AND (? IS NULL OR e.exchange_type=?) AND (? IS NULL OR e.code=?)
        )
        SELECT exchange, exchange_name_fa, exchange_name_en, exchange_type, asset, timeframe,
               calculated_at_ms, price, open_price, close_price, high_price, low_price, value,
               toman_collected_at_ms, usdt_collected_at_ms
        FROM ranked WHERE row_num=1 ORDER BY exchange, asset
      `).bind(timeframe, type, type, exchange, exchange).all();
      return rows.results;
    });
  }

  if (url.pathname === "/api/v1/estimates/usdt-tmn/exchanges") {
    return cachedJson(request, async () => {
      const timeframe = url.searchParams.get("timeframe") || "5m";
      const rows = await env.DB.prepare(`
        WITH ranked AS (
          SELECT i.*, e.code AS exchange, e.name_fa AS exchange_name_fa,
                 e.name_en AS exchange_name_en, e.exchange_type, tf.code AS timeframe,
                 ROW_NUMBER() OVER (PARTITION BY i.scope_key, i.timeframe_id
                                    ORDER BY i.calculated_at_ms DESC) AS row_num
          FROM usdt_index_samples i
          JOIN exchanges e ON e.code=i.scope_key
          JOIN timeframes tf ON tf.id=i.timeframe_id
          WHERE i.scope_type='exchange' AND tf.code=?
        )
        SELECT exchange, exchange_name_fa, exchange_name_en, exchange_type, timeframe,
               calculated_at_ms, price, open_price, close_price, high_price, low_price,
               value, asset_count, source_oldest_at_ms, source_newest_at_ms
        FROM ranked WHERE row_num=1 ORDER BY exchange
      `).bind(timeframe).all();
      return rows.results;
    });
  }

  return json({ error: "not_found" }, 404);
}

export async function route(request, env) {
  const response = await routeApi(request, env);
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, POST, PATCH, DELETE, OPTIONS");
  headers.set("access-control-allow-headers", "Content-Type, Authorization");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
