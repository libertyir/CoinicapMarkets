export class ExchangeMarket {
  constructor(row) {
    this.exchange = row.exchange;
    this.exchange_name_fa = row.exchange_name_fa;
    this.exchange_name_en = row.exchange_name_en;
    this.exchange_type = row.exchange_type;
    this.market = row.market;
    this.display_name_fa = row.display_name_fa;
    this.display_name_en = row.display_name_en;
    this.native_symbol = row.native_symbol;
    this.exchange_pair_enabled = Boolean(row.exchange_pair_enabled);
    this.endpoint = row.endpoint_key ? {
      key: row.endpoint_key, auth_mode: row.auth_mode,
      method: row.http_method, url_template: row.url_template,
      query: row.query_template_json,
      response_items_path: row.response_items_path,
      response_field_map: row.response_field_map_json,
      volume_unit: row.volume_unit, timeout_ms: row.timeout_ms,
      poll_interval_seconds: row.poll_interval_seconds, enabled: Boolean(row.endpoint_enabled),
    } : null;
    this.timeframe = row.timeframe;
    this.source_interval_code = row.source_interval_code;
    this.timeframe_enabled = row.timeframe_enabled === null
      ? null : Boolean(row.timeframe_enabled);
  }
}
