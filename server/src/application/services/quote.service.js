import { ApplicationError } from "../../domain/errors/application-error.js";
import { validateHistoryRange } from "../validation/history-range.js";

export class QuoteService {
  constructor(repository) { this.repository = repository; }
  latest(filters) { return this.repository.listLatest(filters); }

  series(filters) {
    const { exchange, market, timeframe, from, to } = filters;
    if (!exchange || !market || !timeframe)
      throw new ApplicationError("invalid_parameters", 400,
        "exchange, market, timeframe, from and to are required; maximum range is 90 days");
    validateHistoryRange({ from, to });
    return this.repository.listSeries(filters);
  }
}
