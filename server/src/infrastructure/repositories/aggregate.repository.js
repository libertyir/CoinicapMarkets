export class AggregateRepository {
  constructor(db) { this.db = db; }

  async latest({ market, timeframe, type } = {}) {
    const result = await this.db.prepare(`
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
    `).bind(market || null, market || null, timeframe || null, timeframe || null,
      type || null, type || null, type || null).all();
    return result.results;
  }

  async series({ market, timeframe, type, from, to }) {
    const result = await this.db.prepare(`
      SELECT c.scope_type, c.scope_key, m.code AS market, tf.code AS timeframe,
             c.calculated_at_ms, c.price, c.open_price, c.close_price,
             c.high_price, c.low_price, c.volume, c.value, c.exchange_count,
             c.source_oldest_at_ms, c.source_newest_at_ms
      FROM computed_market_samples c JOIN markets m ON m.id=c.market_id
      JOIN timeframes tf ON tf.id=c.timeframe_id
      WHERE m.code=? AND tf.code=? AND c.calculated_at_ms BETWEEN ? AND ?
        AND ((? IS NULL AND c.scope_type IN ('all', 'exchange_type'))
          OR (? IS NOT NULL AND c.scope_type='exchange_type' AND c.scope_key=?))
      ORDER BY c.calculated_at_ms, c.scope_type, c.scope_key LIMIT 20000
    `).bind(market, timeframe, from, to, type || null, type || null, type || null).all();
    return result.results;
  }

  async latestDirectMarket(marketId, timeframeId, scopeType, scopeKey, calculatedAtMs) {
    return this.db.prepare(`
      SELECT c.price, c.open_price, c.close_price, c.high_price, c.low_price,
             c.value, c.exchange_count, c.calculated_at_ms
      FROM computed_market_samples c
      WHERE c.market_id=? AND c.timeframe_id=? AND c.scope_type=? AND c.scope_key=?
        AND c.calculated_at_ms=?
      ORDER BY c.calculated_at_ms DESC LIMIT 1
    `).bind(marketId, timeframeId, scopeType, scopeKey, calculatedAtMs).first();
  }
}
