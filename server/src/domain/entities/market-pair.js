export class MarketPair {
  constructor(row) {
    this.id = row.id;
    this.code = row.code;
    this.display_name_fa = row.display_name_fa;
    this.display_name_en = row.display_name_en;
    this.base_asset = row.base_asset;
    this.base_name_fa = row.base_name_fa;
    this.base_name_en = row.base_name_en;
    this.base_asset_type = row.base_asset_type;
    this.quote_asset = row.quote_asset;
    this.quote_name_fa = row.quote_name_fa;
    this.quote_name_en = row.quote_name_en;
    this.quote_asset_type = row.quote_asset_type;
    this.display_order = row.display_order;
    this.price_precision = row.price_precision;
    this.enabled = row.enabled === undefined ? true : Boolean(row.enabled);
  }
}
