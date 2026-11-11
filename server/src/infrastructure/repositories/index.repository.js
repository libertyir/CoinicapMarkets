import { IndexDefinition } from "../../domain/entities/index-definition.js";

export class IndexRepository {
  constructor(db) { this.db = db; }

  async listEnabled() {
    const definitions = await this.db.prepare(`
      SELECT i.id, i.code, i.base_asset_id, i.quote_asset_id, i.direct_market_id,
             i.method_key, i.name_fa, i.name_en, i.enabled, i.display_order,
             base.code AS base_asset, quote.code AS quote_asset, direct.code AS direct_market
      FROM index_definitions i
      JOIN assets base ON base.id=i.base_asset_id
      JOIN assets quote ON quote.id=i.quote_asset_id
      JOIN markets direct ON direct.id=i.direct_market_id
      WHERE i.enabled=1 ORDER BY i.display_order, i.code
    `).all();
    if (!definitions.results.length) return [];
    const components = await this.db.prepare(`
      SELECT c.index_definition_id, c.asset_id, a.code AS asset,
             c.numerator_market_id, numerator.code AS numerator_market,
             c.denominator_market_id, denominator.code AS denominator_market,
             c.enabled, c.display_order
      FROM index_definition_components c JOIN assets a ON a.id=c.asset_id
      JOIN markets numerator ON numerator.id=c.numerator_market_id
      JOIN markets denominator ON denominator.id=c.denominator_market_id
      WHERE c.enabled=1 ORDER BY c.index_definition_id, c.display_order, a.code
    `).all();
    const byIndex = new Map();
    for (const component of components.results) {
      if (!byIndex.has(component.index_definition_id)) byIndex.set(component.index_definition_id, []);
      byIndex.get(component.index_definition_id).push(component);
    }
    return definitions.results.map((row) => new IndexDefinition(row, byIndex.get(row.id) || []));
  }

  async findEnabled(code) {
    return (await this.listEnabled()).find((definition) => definition.code === code) || null;
  }

  async latest(definitionId, timeframe, scopeType, scopeKey) {
    return this.db.prepare(`
      SELECT i.scope_type, i.scope_key, i.timeframe_id, tf.code AS timeframe, i.calculated_at_ms,
             i.price, i.open_price, i.close_price, i.high_price, i.low_price, i.value,
             i.exchange_count, i.asset_count, i.source_oldest_at_ms, i.source_newest_at_ms
      FROM price_index_samples i JOIN timeframes tf ON tf.id=i.timeframe_id
      WHERE i.index_definition_id=? AND tf.code=? AND i.scope_type=? AND i.scope_key=?
      ORDER BY i.calculated_at_ms DESC LIMIT 1
    `).bind(definitionId, timeframe, scopeType, scopeKey).first();
  }

  async latestByExchange(definitionId, timeframe) {
    const result = await this.db.prepare(`
      WITH ranked AS (
        SELECT i.*, e.code AS exchange, e.name_fa AS exchange_name_fa,
               e.name_en AS exchange_name_en, e.exchange_type, tf.code AS timeframe,
               ROW_NUMBER() OVER (PARTITION BY i.scope_key, i.timeframe_id
                                  ORDER BY i.calculated_at_ms DESC) AS row_num
        FROM price_index_samples i JOIN exchanges e ON e.code=i.scope_key
        JOIN timeframes tf ON tf.id=i.timeframe_id
        WHERE i.index_definition_id=? AND i.scope_type='exchange' AND tf.code=?
      )
      SELECT exchange, exchange_name_fa, exchange_name_en, exchange_type, timeframe,
             calculated_at_ms, price, open_price, close_price, high_price, low_price,
             value, asset_count, source_oldest_at_ms, source_newest_at_ms
      FROM ranked WHERE row_num=1 ORDER BY exchange
    `).bind(definitionId, timeframe).all();
    return result.results;
  }

  async series(definitionId, timeframe, scopeType, scopeKey, from, to) {
    const result = await this.db.prepare(`
      SELECT i.scope_type, i.scope_key, tf.code AS timeframe, i.calculated_at_ms,
             i.price, i.open_price, i.close_price, i.high_price, i.low_price,
             i.value, i.exchange_count, i.asset_count, i.source_oldest_at_ms,
             i.source_newest_at_ms, direct.price AS direct_market_price
      FROM price_index_samples i JOIN timeframes tf ON tf.id=i.timeframe_id
      LEFT JOIN computed_market_samples direct
        ON direct.market_id=? AND direct.timeframe_id=i.timeframe_id
        AND direct.scope_type=i.scope_type AND direct.scope_key=i.scope_key
        AND direct.calculated_at_ms=i.calculated_at_ms
      WHERE i.index_definition_id=? AND tf.code=? AND i.scope_type=? AND i.scope_key=?
        AND i.calculated_at_ms BETWEEN ? AND ?
      ORDER BY i.calculated_at_ms LIMIT 20000
    `).bind(definitionId, definitionId, timeframe, scopeType, scopeKey, from, to).all();
    return result.results;
  }

  async latestComponents(definitionId, timeframe, { type, exchange } = {}) {
    const result = await this.db.prepare(`
      WITH ranked AS (
        SELECT c.*, e.code AS exchange, e.name_fa AS exchange_name_fa,
               e.name_en AS exchange_name_en, e.exchange_type, a.code AS asset,
               tf.code AS timeframe, numerator.collected_at_ms AS numerator_collected_at_ms,
               denominator.collected_at_ms AS denominator_collected_at_ms,
               ROW_NUMBER() OVER (PARTITION BY c.index_definition_id, c.exchange_id, c.asset_id, c.timeframe_id
                                  ORDER BY c.calculated_at_ms DESC) AS row_num
        FROM price_index_component_samples c
        JOIN exchanges e ON e.id=c.exchange_id JOIN assets a ON a.id=c.asset_id
        JOIN timeframes tf ON tf.id=c.timeframe_id
        JOIN market_data_samples numerator ON numerator.id=c.numerator_sample_id
        JOIN market_data_samples denominator ON denominator.id=c.denominator_sample_id
        WHERE c.index_definition_id=? AND tf.code=?
          AND (? IS NULL OR e.exchange_type=?) AND (? IS NULL OR e.code=?)
      )
      SELECT exchange, exchange_name_fa, exchange_name_en, exchange_type, asset, timeframe,
             calculated_at_ms, price, open_price, close_price, high_price, low_price, value,
             numerator_collected_at_ms, denominator_collected_at_ms
      FROM ranked WHERE row_num=1 ORDER BY exchange, asset
    `).bind(definitionId, timeframe, type || null, type || null,
      exchange || null, exchange || null).all();
    return result.results;
  }
}
