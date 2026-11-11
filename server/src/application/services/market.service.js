export class MarketService {
  constructor(repository) { this.repository = repository; }
  listAssets() { return this.repository.listEnabledAssets(); }
  listPairs() { return this.repository.listEnabledPairs(); }
  listTimeframes(filters) { return this.repository.listTimeframes(filters); }
  listExchangePairs(filters) { return this.repository.listExchangePairs(filters); }
}
