import { ApplicationError } from "../../domain/errors/application-error.js";
import { validateHistoryRange } from "../validation/history-range.js";

export class AggregateService {
  constructor(repository) { this.repository = repository; }
  latest(filters) { return this.repository.latest(filters); }

  series(filters) {
    if (!filters.market || !filters.timeframe)
      throw new ApplicationError("invalid_parameters", 400, "market and timeframe are required");
    validateHistoryRange(filters);
    return this.repository.series(filters);
  }
}
