import { Asset } from "../../domain/entities/asset.js";
import { ExchangeMarket } from "../../domain/entities/exchange-market.js";
import { MarketPair } from "../../domain/entities/market-pair.js";

export class MarketRepository {
  constructor(db) { this.db = db; }

  async listEnabledAssets() {
    const result = await this.db.prepare(`
      SELECT id, code, asset_type, name_fa, name_en, enabled, display_order
      FROM assets WHERE enabled=1 ORDER BY display_order, code
    `).all();
    return result.results.map((row) => new Asset(row));
  }

  async listEnabledPairs() {
    const result = await this.db.prepare(`
      SELECT m.id, m.code, m.display_name_fa, m.display_name_en, m.enabled,
             m.display_order, m.price_precision,
             b.code AS base_asset, b.name_fa AS base_name_fa,
             b.name_en AS base_name_en, b.asset_type AS base_asset_type,
             q.code AS quote_asset, q.name_fa AS quote_name_fa,
             q.name_en AS quote_name_en, q.asset_type AS quote_asset_type
      FROM markets m JOIN assets b ON b.id=m.base_asset_id
      JOIN assets q ON q.id=m.quote_asset_id
      WHERE m.enabled=1 AND b.enabled=1 AND q.enabled=1
      ORDER BY m.display_order, m.code
    `).all();
    return result.results.map((row) => new MarketPair(row));
  }

  async listTimeframes({ exchange, market } = {}) {
    const result = await this.db.prepare(`
      SELECT DISTINCT tf.code, tf.duration_seconds, tf.display_order
      FROM timeframes tf
      JOIN exchange_market_timeframes emt ON emt.timeframe_id=tf.id AND emt.enabled=1
      JOIN exchange_markets em ON em.id=emt.exchange_market_id AND em.enabled=1
      JOIN exchanges e ON e.id=em.exchange_id AND e.enabled=1
      JOIN markets m ON m.id=em.market_id AND m.enabled=1
      WHERE tf.enabled=1 AND (? IS NULL OR e.code=?) AND (? IS NULL OR m.code=?)
      ORDER BY tf.display_order, tf.duration_seconds
    `).bind(exchange || null, exchange || null, market || null, market || null).all();
    return result.results;
  }

  async listExchangePairs({ exchange, market } = {}) {
    const result = await this.db.prepare(`
      SELECT e.code AS exchange, e.name_fa AS exchange_name_fa,
             e.name_en AS exchange_name_en, e.exchange_type,
             m.code AS market, m.display_name_fa, m.display_name_en,
             em.native_symbol, em.enabled AS exchange_pair_enabled,
             ep.endpoint_key, ep.auth_mode, ep.http_method,
             ep.url_template, ep.query_template_json,
             ep.response_items_path, ep.response_field_map_json, ep.volume_unit,
             ep.timeout_ms, ep.poll_interval_seconds, ep.enabled AS endpoint_enabled,
             tf.code AS timeframe, emt.source_interval_code, emt.enabled AS timeframe_enabled
      FROM exchange_markets em
      JOIN exchanges e ON e.id=em.exchange_id
      JOIN markets m ON m.id=em.market_id
      LEFT JOIN exchange_market_timeframes emt ON emt.exchange_market_id=em.id
      LEFT JOIN timeframes tf ON tf.id=emt.timeframe_id
      LEFT JOIN exchange_api_endpoints ep ON ep.id=emt.endpoint_id
      WHERE e.enabled=1 AND m.enabled=1 AND em.enabled=1
        AND (? IS NULL OR e.code=?) AND (? IS NULL OR m.code=?)
      ORDER BY e.display_order, m.display_order, tf.duration_seconds
    `).bind(exchange || null, exchange || null, market || null, market || null).all();
    return result.results.map((row) => new ExchangeMarket(row));
  }
}
