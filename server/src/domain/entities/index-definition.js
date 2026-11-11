import { IndexComponent } from "./index-component.js";

export class IndexDefinition {
  constructor(row, components = []) {
    this.id = row.id;
    this.code = row.code;
    this.base_asset_id = row.base_asset_id;
    this.quote_asset_id = row.quote_asset_id;
    this.direct_market_id = row.direct_market_id;
    this.base_asset = row.base_asset;
    this.quote_asset = row.quote_asset;
    this.direct_market = row.direct_market;
    this.method_key = row.method_key;
    this.name_fa = row.name_fa;
    this.name_en = row.name_en;
    this.enabled = Boolean(row.enabled);
    this.display_order = row.display_order;
    this.components = components.map((component) => new IndexComponent(component));
  }
}
