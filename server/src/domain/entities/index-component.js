export class IndexComponent {
  constructor(row) {
    this.asset_id = row.asset_id;
    this.asset = row.asset;
    this.numerator_market_id = row.numerator_market_id;
    this.numerator_market = row.numerator_market;
    this.denominator_market_id = row.denominator_market_id;
    this.denominator_market = row.denominator_market;
    this.enabled = Boolean(row.enabled);
    this.display_order = row.display_order;
  }
}
