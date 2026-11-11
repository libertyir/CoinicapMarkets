import { average, extreme, ratio, total } from "./decimal.js";

const MAX_SAMPLE_AGE_MS = 6 * 60 * 1000;

function newestByExchangeBase(samples) {
  const pairs = new Map();
  for (const sample of samples) {
    const key = `${sample.exchange_id}:${sample.timeframe_id}:${sample.base_code}:${sample.quote_code}`;
    if (!pairs.has(key)) pairs.set(key, sample);
  }
  return pairs;
}

function impliedComponent(toman, usdt, calculatedAt) {
  if (Math.abs(toman.collected_at_ms - usdt.collected_at_ms) > MAX_SAMPLE_AGE_MS) return null;
  const price = ratio(toman.price, usdt.price);
  if (price === null) return null;
  return {
    exchange_id: toman.exchange_id, exchange: toman.exchange, exchange_type: toman.exchange_type,
    asset_id: toman.base_asset_id, asset: toman.base_code, timeframe_id: toman.timeframe_id,
    calculated_at_ms: calculatedAt, price,
    open_price: ratio(toman.open_price, usdt.open_price),
    close_price: ratio(toman.close_price, usdt.close_price),
    high_price: ratio(toman.top_price, usdt.low_price),
    low_price: ratio(toman.low_price, usdt.top_price),
    value: toman.value, toman_sample_id: toman.id, usdt_sample_id: usdt.id,
    toman_collected_at_ms: toman.collected_at_ms, usdt_collected_at_ms: usdt.collected_at_ms,
  };
}

function aggregateMarket(quotes, scopeType, scopeKey, marketId, timeframeId, at) {
  return {
    scope_type: scopeType, scope_key: scopeKey, market_id: marketId,
    timeframe_id: timeframeId, calculated_at_ms: at,
    price: average(quotes.map((quote) => quote.price)),
    open_price: average(quotes.map((quote) => quote.open_price)),
    close_price: average(quotes.map((quote) => quote.close_price)),
    high_price: extreme(quotes.map((quote) => quote.price), "max"),
    low_price: extreme(quotes.map((quote) => quote.price), "min"),
    volume: total(quotes.map((quote) => quote.volume)),
    value: total(quotes.map((quote) => quote.value)),
    exchange_count: new Set(quotes.map((quote) => quote.exchange_id)).size,
    source_oldest_at_ms: Math.min(...quotes.map((quote) => quote.collected_at_ms)),
    source_newest_at_ms: Math.max(...quotes.map((quote) => quote.collected_at_ms)),
  };
}

function aggregateIndex(components, scopeType, scopeKey, at, exchangeCount) {
  return {
    scope_type: scopeType, scope_key: scopeKey, timeframe_id: components[0].timeframe_id,
    calculated_at_ms: at,
    price: average(components.map((item) => item.price)),
    open_price: average(components.map((item) => item.open_price)),
    close_price: average(components.map((item) => item.close_price)),
    high_price: extreme(components.map((item) => item.price), "max"),
    low_price: extreme(components.map((item) => item.price), "min"),
    value: total(components.map((item) => item.value)),
    exchange_count: exchangeCount,
    asset_count: new Set(components.map((item) => item.asset_id)).size,
    source_oldest_at_ms: Math.min(...components.flatMap((item) => [item.toman_collected_at_ms, item.usdt_collected_at_ms])),
    source_newest_at_ms: Math.max(...components.flatMap((item) => [item.toman_collected_at_ms, item.usdt_collected_at_ms])),
  };
}

function marketStatements(db, groups) {
  return groups.map((row) => db.prepare(`
    INSERT INTO computed_market_samples
      (scope_type, scope_key, market_id, timeframe_id, calculated_at_ms, price,
       open_price, close_price, high_price, low_price, volume, value, exchange_count,
       source_oldest_at_ms, source_newest_at_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(row.scope_type, row.scope_key, row.market_id, row.timeframe_id, row.calculated_at_ms,
    row.price, row.open_price, row.close_price, row.high_price, row.low_price,
    row.volume, row.value, row.exchange_count, row.source_oldest_at_ms, row.source_newest_at_ms));
}

function indexStatements(db, components, indexes) {
  const writes = components.map((row) => db.prepare(`
    INSERT INTO usdt_index_component_samples
      (exchange_id, asset_id, timeframe_id, calculated_at_ms, price, open_price,
       close_price, high_price, low_price, value, toman_sample_id, usdt_sample_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(row.exchange_id, row.asset_id, row.timeframe_id, row.calculated_at_ms,
    row.price, row.open_price, row.close_price, row.high_price, row.low_price,
    row.value, row.toman_sample_id, row.usdt_sample_id));
  writes.push(...indexes.map((row) => db.prepare(`
    INSERT INTO usdt_index_samples
      (scope_type, scope_key, timeframe_id, calculated_at_ms, price, open_price,
       close_price, high_price, low_price, value, exchange_count, asset_count,
       source_oldest_at_ms, source_newest_at_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(row.scope_type, row.scope_key, row.timeframe_id, row.calculated_at_ms,
    row.price, row.open_price, row.close_price, row.high_price, row.low_price,
    row.value, row.exchange_count, row.asset_count,
    row.source_oldest_at_ms, row.source_newest_at_ms)));
  return writes;
}

/** Rebuild materialized aggregates after a collection cycle has stored samples. */
export async function recomputeDerivedData(env, calculatedAtMs = Date.now()) {
  const sampleRows = await env.DB.prepare(`
    WITH ranked AS (
      SELECT s.*, ROW_NUMBER() OVER (
        PARTITION BY s.exchange_market_id, s.timeframe_id ORDER BY s.collected_at_ms DESC
      ) AS row_num
      FROM market_data_samples s WHERE s.collected_at_ms >= ?
    )
    SELECT s.id, s.exchange_market_id, em.exchange_id, e.code AS exchange, e.exchange_type,
           m.id AS market_id, m.code AS market, b.id AS base_asset_id, b.code AS base_code,
           q.code AS quote_code, tf.id AS timeframe_id, tf.code AS timeframe,
           s.price, s.open_price, s.close_price, s.volume, s.value, s.top_price, s.low_price,
           s.collected_at_ms
    FROM ranked s
    JOIN exchange_markets em ON em.id=s.exchange_market_id AND em.enabled=1
    JOIN exchange_market_timeframes emt ON emt.exchange_market_id=em.id
      AND emt.timeframe_id=s.timeframe_id AND emt.enabled=1
    JOIN exchanges e ON e.id=em.exchange_id AND e.enabled=1
    JOIN markets m ON m.id=em.market_id AND m.enabled=1
    JOIN assets b ON b.id=m.base_asset_id AND b.enabled=1
    JOIN assets q ON q.id=m.quote_asset_id AND q.enabled=1
    JOIN timeframes tf ON tf.id=s.timeframe_id AND tf.enabled=1
    WHERE s.row_num=1 ORDER BY tf.id, m.id, e.id
  `).bind(calculatedAtMs - MAX_SAMPLE_AGE_MS).all();
  const samples = sampleRows.results;
  if (!samples.length) return { markets: 0, components: 0, indices: 0 };

  const marketGroups = new Map();
  for (const row of samples) {
    const key = `${row.market_id}:${row.timeframe_id}`;
    if (!marketGroups.has(key)) marketGroups.set(key, []);
    marketGroups.get(key).push(row);
  }
  const marketRows = [];
  for (const [key, quotes] of marketGroups) {
    const [marketId, timeframeId] = key.split(":").map(Number);
    marketRows.push(aggregateMarket(quotes, "all", "all", marketId, timeframeId, calculatedAtMs));
    for (const type of new Set(quotes.map((quote) => quote.exchange_type))) {
      marketRows.push(aggregateMarket(quotes.filter((quote) => quote.exchange_type === type),
        "exchange_type", type, marketId, timeframeId, calculatedAtMs));
    }
  }

  const pairMap = newestByExchangeBase(samples);
  const componentRows = [];
  for (const toman of samples.filter((row) => row.quote_code === "TMN")) {
    const usdt = pairMap.get(`${toman.exchange_id}:${toman.timeframe_id}:${toman.base_code}:USDT`);
    if (!usdt) continue;
    const component = impliedComponent(toman, usdt, calculatedAtMs);
    if (component) componentRows.push(component);
  }
  const exchangeGroups = new Map();
  for (const row of componentRows) {
    const key = `${row.exchange_id}:${row.timeframe_id}`;
    if (!exchangeGroups.has(key)) exchangeGroups.set(key, []);
    exchangeGroups.get(key).push(row);
  }
  const perExchange = [...exchangeGroups.values()].map((rows) => ({
    ...aggregateIndex(rows, "exchange", rows[0].exchange, calculatedAtMs, 1),
    exchange_type: rows[0].exchange_type,
  }));
  const indexRows = [...perExchange];
  for (const timeframeId of new Set(perExchange.map((row) => row.timeframe_id))) {
    const current = perExchange.filter((row) => row.timeframe_id === timeframeId);
    indexRows.push(aggregateIndex(current, "all", "all", calculatedAtMs, current.length));
    for (const type of new Set(current.map((row) => row.exchange_type))) {
      indexRows.push(aggregateIndex(current.filter((row) => row.exchange_type === type),
        "exchange_type", type, calculatedAtMs,
        current.filter((row) => row.exchange_type === type).length));
    }
  }

  const writes = [
    ...marketStatements(env.DB, marketRows),
    ...indexStatements(env.DB, componentRows, indexRows),
  ];
  if (writes.length) await env.DB.batch(writes);
  return { markets: marketRows.length, components: componentRows.length, indices: indexRows.length };
}
