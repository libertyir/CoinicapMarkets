import { ExchangeService } from "./services/exchange.service.js";
import { MarketService } from "./services/market.service.js";
import { QuoteService } from "./services/quote.service.js";
import { AggregateService } from "./services/aggregate.service.js";
import { IndexService } from "./services/index.service.js";
import { DerivedDataService } from "./services/derived-data.service.js";
import { ExchangeRepository } from "../infrastructure/repositories/exchange.repository.js";
import { MarketRepository } from "../infrastructure/repositories/market.repository.js";
import { QuoteRepository } from "../infrastructure/repositories/quote.repository.js";
import { AggregateRepository } from "../infrastructure/repositories/aggregate.repository.js";
import { IndexRepository } from "../infrastructure/repositories/index.repository.js";
import { DerivedDataRepository } from "../infrastructure/repositories/derived-data.repository.js";
import { AccessRepository } from "../infrastructure/repositories/access.repository.js";
import { AccessService } from "./services/access.service.js";
import { HistorySyncService } from "./services/history-sync.service.js";
import { HistorySyncRepository } from "../infrastructure/repositories/history-sync.repository.js";

export function createApplication(env) {
  const exchanges = new ExchangeRepository(env.DB);
  const markets = new MarketRepository(env.DB);
  const quotes = new QuoteRepository(env.DB);
  const aggregates = new AggregateRepository(env.DB);
  const indexes = new IndexRepository(env.DB);
  const derived = new DerivedDataRepository(env.DB);
  const access = new AccessRepository(env.DB);
  const historySync = new HistorySyncRepository(env.DB);
  return {
    exchanges: new ExchangeService(exchanges),
    markets: new MarketService(markets),
    quotes: new QuoteService(quotes),
    aggregates: new AggregateService(aggregates),
    indexes: new IndexService(indexes, aggregates),
    derived: new DerivedDataService(quotes, indexes, derived),
    access: new AccessService(access),
    accessRepository: access,
    historySync: new HistorySyncService(historySync),
  };
}
