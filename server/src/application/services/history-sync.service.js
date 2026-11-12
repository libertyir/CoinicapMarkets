import { ApplicationError } from "../../domain/errors/application-error.js";

const MAX_IMPORT_CANDLES=1000;
export class HistorySyncService {
  constructor(repository) { this.repository=repository; }
  async importJson(payload) {
    if (!payload || payload.format!=="coinicap.history.v1" ||
        !/^[a-z0-9-]{2,40}$/.test(payload.exchange||"") ||
        !/^[A-Z0-9]{3,24}$/.test(payload.market||"") ||
        !/^[1-9][0-9]*[mhd]$/.test(payload.timeframe||"") ||
        !Array.isArray(payload.candles) || payload.candles.length<1 || payload.candles.length>MAX_IMPORT_CANDLES)
      throw new ApplicationError("invalid_history_import",400,
        "Expected coinicap.history.v1 and 1-1000 candles with exchange, market, timeframe");
    return this.repository.importJson(payload);
  }
}
