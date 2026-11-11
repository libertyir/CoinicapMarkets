export class DerivedDataRepository {
  constructor(db) { this.db = db; }

  async save(marketRows, componentRows, indexRows) {
    const statements = [
      ...marketRows.map((row) => this.db.prepare(`
        INSERT INTO computed_market_samples
          (scope_type, scope_key, market_id, timeframe_id, calculated_at_ms, price,
           open_price, close_price, high_price, low_price, volume, value, exchange_count,
           source_oldest_at_ms, source_newest_at_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(row.scope_type, row.scope_key, row.market_id, row.timeframe_id, row.calculated_at_ms,
        row.price, row.open_price, row.close_price, row.high_price, row.low_price, row.volume,
        row.value, row.exchange_count, row.source_oldest_at_ms, row.source_newest_at_ms)),
      ...componentRows.map((row) => this.db.prepare(`
        INSERT INTO price_index_component_samples
          (index_definition_id, exchange_id, asset_id, timeframe_id, calculated_at_ms,
           price, open_price, close_price, high_price, low_price, value,
           numerator_sample_id, denominator_sample_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(row.index_definition_id, row.exchange_id, row.asset_id, row.timeframe_id,
        row.calculated_at_ms, row.price, row.open_price, row.close_price, row.high_price,
        row.low_price, row.value, row.numerator_sample_id, row.denominator_sample_id)),
      ...indexRows.map((row) => this.db.prepare(`
        INSERT INTO price_index_samples
          (index_definition_id, scope_type, scope_key, timeframe_id, calculated_at_ms,
           price, open_price, close_price, high_price, low_price, value, exchange_count,
           asset_count, source_oldest_at_ms, source_newest_at_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(row.index_definition_id, row.scope_type, row.scope_key, row.timeframe_id,
        row.calculated_at_ms, row.price, row.open_price, row.close_price, row.high_price,
        row.low_price, row.value, row.exchange_count, row.asset_count,
        row.source_oldest_at_ms, row.source_newest_at_ms)),
    ];
    if (statements.length) await this.db.batch(statements);
    return statements.length;
  }
}
