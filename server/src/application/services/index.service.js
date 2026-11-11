import { ApplicationError } from "../../domain/errors/application-error.js";
import { percentageDifference } from "../../domain/providers/decimal-math.provider.js";
import { validateHistoryRange } from "../validation/history-range.js";

const SCOPES = new Set(["cex", "otc", "hybrid"]);

export class IndexService {
  constructor(indexRepository, aggregateRepository) {
    this.indexes = indexRepository;
    this.aggregates = aggregateRepository;
  }

  list() { return this.indexes.listEnabled(); }

  async latest(code, { timeframe = "5m", type, exchange } = {}) {
    const definition = await this.indexes.findEnabled(code);
    if (!definition) throw new ApplicationError("index_not_found", 404);
    if (type && !SCOPES.has(type)) throw new ApplicationError("invalid_index_scope", 400);
    const scopeType = exchange ? "exchange" : type ? "exchange_type" : "all";
    const scopeKey = exchange || type || "all";
    const index = await this.indexes.latest(definition.id, timeframe, scopeType, scopeKey);
    const direct = index ? await this.aggregates.latestDirectMarket(
      definition.direct_market_id, index.timeframe_id, scopeType, scopeKey, index.calculated_at_ms
    ) : null;
    return {
      status: index ? "available" : "no_data",
      definition,
      method: definition.method_key,
      formula_version: `${definition.method_key}-v1`,
      scope_type: scopeType, scope: scopeKey, timeframe,
      index, direct_market: direct,
      gap_percent: percentageDifference(index?.price, direct?.price),
      quality_flags: [!index && "no_fresh_components", !direct && "no_direct_market_sample"]
        .filter(Boolean),
    };
  }

  async series(code, { timeframe = "5m", type, exchange, from, to } = {}) {
    validateHistoryRange({ from, to });
    if (type && !SCOPES.has(type)) throw new ApplicationError("invalid_index_scope", 400);
    const definition = await this.indexes.findEnabled(code);
    if (!definition) throw new ApplicationError("index_not_found", 404);
    const scopeType = exchange ? "exchange" : type ? "exchange_type" : "all";
    const scopeKey = exchange || type || "all";
    const rows = await this.indexes.series(
      definition.id, timeframe, scopeType, scopeKey, from, to
    );
    return rows.map((row) => ({
      ...row,
      gap_percent: percentageDifference(row.price, row.direct_market_price),
    }));
  }

  components(code, timeframe, filters) {
    return this.indexes.findEnabled(code).then((definition) => {
      if (!definition) throw new ApplicationError("index_not_found", 404);
      if (filters.type && !SCOPES.has(filters.type))
        throw new ApplicationError("invalid_index_scope", 400);
      return this.indexes.latestComponents(definition.id, timeframe, filters);
    });
  }

  async exchanges(code, timeframe) {
    const definition = await this.indexes.findEnabled(code);
    if (!definition) throw new ApplicationError("index_not_found", 404);
    return this.indexes.latestByExchange(definition.id, timeframe);
  }
}
