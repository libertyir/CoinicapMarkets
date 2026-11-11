import { MarketAggregateProvider } from "../../domain/providers/market-aggregate.provider.js";
import { CrossRateIndexProvider } from "../../domain/providers/cross-rate-index.provider.js";

const MAX_SAMPLE_AGE_MS = 6 * 60 * 1000;

export class DerivedDataService {
  constructor(quoteRepository, indexRepository, derivedRepository) {
    this.quotes = quoteRepository;
    this.indexes = indexRepository;
    this.derived = derivedRepository;
    this.marketProvider = new MarketAggregateProvider();
    this.indexProvider = new CrossRateIndexProvider();
  }

  async recompute(calculatedAtMs = Date.now()) {
    const samples = await this.quotes.listFreshForCalculation(calculatedAtMs - MAX_SAMPLE_AGE_MS);
    if (!samples.length) return { markets: 0, components: 0, indices: 0 };
    const definitions = await this.indexes.listEnabled();
    const marketRows = this.marketProvider.calculate(samples, calculatedAtMs);
    const components = [];
    const indexes = [];
    for (const definition of definitions) {
      const result = this.indexProvider.calculate(definition, samples, calculatedAtMs);
      components.push(...result.components);
      indexes.push(...result.indexes);
    }
    await this.derived.save(marketRows, components, indexes);
    return { markets: marketRows.length, components: components.length, indices: indexes.length };
  }
}
