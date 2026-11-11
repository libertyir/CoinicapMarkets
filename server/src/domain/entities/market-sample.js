export class MarketSample {
  constructor(row) {
    Object.assign(this, row);
    this.exchange_id = Number(row.exchange_id);
    this.market_id = Number(row.market_id);
    this.timeframe_id = Number(row.timeframe_id);
  }
}
