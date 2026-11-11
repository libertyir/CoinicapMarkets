import { MarketSample } from "../../domain/entities/market-sample.js";

export class QuoteRepository {
  constructor(db) { this.db = db; }

  async listLatest(filters = {}) {
    const { exchange, market, timeframe } = filters;
    const result = await this.db.prepare(`
      WITH ranked AS (
        SELECT s.*, ROW_NUMBER() OVER (
          PARTITION BY s.exchange_market_id, s.timeframe_id ORDER BY s.collected_at_ms DESC
        ) AS row_num FROM market_data_samples s
      )
      SELECT e.id AS exchange_id, e.code AS exchange, e.name_fa AS exchange_name_fa,
             e.name_en AS exchange_name_en, e.exchange_type,
             m.id AS market_id, s.output_market_symbol AS market,
             s.native_symbol AS exchange_symbol, tf.id AS timeframe_id, tf.code AS timeframe,
             b.code AS base_asset, q.code AS quote_asset, s.price, s.open_price,
             s.close_price, s.volume, s.value, s.top_price, s.low_price,
             s.source_interval_code, s.source_open_time_ms, s.source_close_time_ms,
             s.source_time_ms, s.collected_at_ms,
             (CAST(strftime('%s','now') AS INTEGER)*1000-s.collected_at_ms) AS age_ms
      FROM ranked s
      JOIN exchange_market_timeframes emt ON emt.exchange_market_id=s.exchange_market_id
        AND emt.timeframe_id=s.timeframe_id AND emt.enabled=1
      JOIN exchange_markets em ON em.id=s.exchange_market_id AND em.enabled=1
      JOIN exchanges e ON e.id=em.exchange_id AND e.enabled=1
      JOIN markets m ON m.id=em.market_id AND m.enabled=1
      JOIN timeframes tf ON tf.id=s.timeframe_id AND tf.enabled=1
      JOIN assets b ON b.id=m.base_asset_id AND b.enabled=1
      JOIN assets q ON q.id=m.quote_asset_id AND q.enabled=1
      WHERE s.row_num=1 AND (? IS NULL OR e.code=?)
        AND (? IS NULL OR m.code=?) AND (? IS NULL OR tf.code=?)
      ORDER BY e.display_order, m.display_order, e.code, m.code, tf.duration_seconds
    `).bind(exchange || null, exchange || null, market || null, market || null,
      timeframe || null, timeframe || null).all();
    return result.results.map((row) => new MarketSample(row));
  }

  async listSeries({ exchange, market, timeframe, from, to }) {
    const result = await this.db.prepare(`
      SELECT e.id AS exchange_id, e.code AS exchange, e.name_fa AS exchange_name_fa,
             e.name_en AS exchange_name_en, e.exchange_type,
             m.id AS market_id, s.output_market_symbol AS market,
             s.native_symbol AS exchange_symbol, tf.id AS timeframe_id, tf.code AS timeframe,
             s.price, s.open_price, s.close_price, s.volume, s.value, s.top_price, s.low_price,
             s.source_interval_code, s.source_open_time_ms, s.source_close_time_ms,
             s.source_time_ms, s.collected_at_ms
      FROM market_data_samples s
      JOIN exchange_market_timeframes emt ON emt.exchange_market_id=s.exchange_market_id
        AND emt.timeframe_id=s.timeframe_id AND emt.enabled=1
      JOIN exchange_markets em ON em.id=s.exchange_market_id AND em.enabled=1
      JOIN exchanges e ON e.id=em.exchange_id AND e.enabled=1
      JOIN markets m ON m.id=em.market_id AND m.enabled=1
      JOIN timeframes tf ON tf.id=s.timeframe_id AND tf.enabled=1
      WHERE e.code=? AND m.code=? AND tf.code=? AND s.collected_at_ms BETWEEN ? AND ?
      ORDER BY s.collected_at_ms LIMIT 20000
    `).bind(exchange, market, timeframe, from, to).all();
    return result.results.map((row) => new MarketSample(row));
  }

  async listFreshForCalculation(cutoffMs) {
    const result = await this.db.prepare(`
      WITH ranked AS (
        SELECT s.*, ROW_NUMBER() OVER (
          PARTITION BY s.exchange_market_id, s.timeframe_id ORDER BY s.collected_at_ms DESC
        ) AS row_num FROM market_data_samples s WHERE s.collected_at_ms>=?
      )
      SELECT s.id, em.exchange_id, e.code AS exchange, e.exchange_type,
             m.id AS market_id, m.code AS market, b.id AS base_asset_id, b.code AS base_code,
             q.id AS quote_asset_id, q.code AS quote_code, tf.id AS timeframe_id,
             tf.code AS timeframe, s.price, s.open_price, s.close_price, s.volume,
             s.value, s.top_price, s.low_price, s.collected_at_ms
      FROM ranked s JOIN exchange_markets em ON em.id=s.exchange_market_id AND em.enabled=1
      JOIN exchange_market_timeframes emt ON emt.exchange_market_id=em.id
        AND emt.timeframe_id=s.timeframe_id AND emt.enabled=1
      JOIN exchanges e ON e.id=em.exchange_id AND e.enabled=1
      JOIN markets m ON m.id=em.market_id AND m.enabled=1
      JOIN assets b ON b.id=m.base_asset_id AND b.enabled=1
      JOIN assets q ON q.id=m.quote_asset_id AND q.enabled=1
      JOIN timeframes tf ON tf.id=s.timeframe_id AND tf.enabled=1
      WHERE s.row_num=1 ORDER BY tf.id, m.id, e.id
    `).bind(cutoffMs).all();
    return result.results;
  }
}
