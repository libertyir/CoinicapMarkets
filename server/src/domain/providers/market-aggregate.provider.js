import { average, extreme, sum } from "./decimal-math.provider.js";

function aggregate(quotes, scopeType, scopeKey, marketId, timeframeId, calculatedAtMs) {
  return {
    scope_type: scopeType, scope_key: scopeKey, market_id: marketId,
    timeframe_id: timeframeId, calculated_at_ms: calculatedAtMs,
    price: average(quotes.map((row) => row.price)),
    open_price: average(quotes.map((row) => row.open_price)),
    close_price: average(quotes.map((row) => row.close_price)),
    high_price: extreme(quotes.map((row) => row.price), "max"),
    low_price: extreme(quotes.map((row) => row.price), "min"),
    volume: sum(quotes.map((row) => row.volume)),
    value: sum(quotes.map((row) => row.value)),
    exchange_count: new Set(quotes.map((row) => row.exchange_id)).size,
    source_oldest_at_ms: Math.min(...quotes.map((row) => row.collected_at_ms)),
    source_newest_at_ms: Math.max(...quotes.map((row) => row.collected_at_ms)),
  };
}

export class MarketAggregateProvider {
  calculate(samples, calculatedAtMs) {
    const groups = new Map();
    for (const sample of samples) {
      const key = `${sample.market_id}:${sample.timeframe_id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(sample);
    }
    const result = [];
    for (const [key, quotes] of groups) {
      const [marketId, timeframeId] = key.split(":").map(Number);
      result.push(aggregate(quotes, "all", "all", marketId, timeframeId, calculatedAtMs));
      for (const type of new Set(quotes.map((row) => row.exchange_type))) {
        result.push(aggregate(quotes.filter((row) => row.exchange_type === type),
          "exchange_type", type, marketId, timeframeId, calculatedAtMs));
      }
    }
    return result;
  }
}
