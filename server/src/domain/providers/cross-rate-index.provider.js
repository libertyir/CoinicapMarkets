import { average, divide, extreme, sum } from "./decimal-math.provider.js";

const MAX_PAIR_SKEW_MS = 6 * 60 * 1000;

function indexRow(rows, definition, scopeType, scopeKey, calculatedAtMs, exchangeCount) {
  const assetIds = rows.flatMap((row) => row.asset_ids || [row.asset_id]);
  const sourceTimes = rows.flatMap((row) => row.numerator_at_ms !== undefined
    ? [row.numerator_at_ms, row.denominator_at_ms]
    : [row.source_oldest_at_ms, row.source_newest_at_ms]).filter(Number.isFinite);
  return {
    index_definition_id: definition.id,
    scope_type: scopeType, scope_key: scopeKey, timeframe_id: rows[0].timeframe_id,
    calculated_at_ms: calculatedAtMs,
    price: average(rows.map((row) => row.price)),
    open_price: average(rows.map((row) => row.open_price)),
    close_price: average(rows.map((row) => row.close_price)),
    high_price: extreme(rows.map((row) => row.price), "max"),
    low_price: extreme(rows.map((row) => row.price), "min"),
    value: sum(rows.map((row) => row.value)),
    exchange_count: exchangeCount,
    asset_count: new Set(assetIds).size,
    source_oldest_at_ms: sourceTimes.length ? Math.min(...sourceTimes) : null,
    source_newest_at_ms: sourceTimes.length ? Math.max(...sourceTimes) : null,
  };
}

export class CrossRateIndexProvider {
  calculate(definition, samples, calculatedAtMs) {
    const sampleByExchangeMarketFrame = new Map();
    for (const sample of samples) {
      sampleByExchangeMarketFrame.set(
        `${sample.exchange_id}:${sample.market_id}:${sample.timeframe_id}`, sample
      );
    }
    const components = [];
    for (const spec of definition.components) {
      for (const numerator of samples.filter((sample) => sample.market_id === spec.numerator_market_id)) {
        const denominator = sampleByExchangeMarketFrame.get(
          `${numerator.exchange_id}:${spec.denominator_market_id}:${numerator.timeframe_id}`
        );
        if (!denominator || Math.abs(numerator.collected_at_ms - denominator.collected_at_ms) > MAX_PAIR_SKEW_MS)
          continue;
        const price = divide(numerator.price, denominator.price);
        if (price === null) continue;
        components.push({
          index_definition_id: definition.id, exchange_id: numerator.exchange_id,
          exchange: numerator.exchange, exchange_type: numerator.exchange_type,
          asset_id: spec.asset_id, asset: spec.asset, timeframe_id: numerator.timeframe_id,
          calculated_at_ms: calculatedAtMs, price,
          open_price: divide(numerator.open_price, denominator.open_price),
          close_price: divide(numerator.close_price, denominator.close_price),
          high_price: divide(numerator.top_price, denominator.low_price),
          low_price: divide(numerator.low_price, denominator.top_price),
          value: numerator.value, numerator_sample_id: numerator.id,
          denominator_sample_id: denominator.id,
          numerator_at_ms: numerator.collected_at_ms,
          denominator_at_ms: denominator.collected_at_ms,
        });
      }
    }

    const perExchangeGroups = new Map();
    for (const row of components) {
      const key = `${row.exchange_id}:${row.timeframe_id}`;
      if (!perExchangeGroups.has(key)) perExchangeGroups.set(key, []);
      perExchangeGroups.get(key).push(row);
    }
    const perExchange = [...perExchangeGroups.values()].map((rows) => ({
      ...indexRow(rows, definition, "exchange", rows[0].exchange, calculatedAtMs, 1),
      exchange_type: rows[0].exchange_type,
      asset_ids: [...new Set(rows.map((row) => row.asset_id))],
    }));
    const indexes = [...perExchange];
    for (const timeframeId of new Set(perExchange.map((row) => row.timeframe_id))) {
      const frameRows = perExchange.filter((row) => row.timeframe_id === timeframeId);
      indexes.push(indexRow(frameRows, definition, "all", "all", calculatedAtMs, frameRows.length));
      for (const type of new Set(frameRows.map((row) => row.exchange_type))) {
        const typeRows = frameRows.filter((row) => row.exchange_type === type);
        indexes.push(indexRow(typeRows, definition, "exchange_type", type, calculatedAtMs, typeRows.length));
      }
    }
    return { components, indexes };
  }
}
