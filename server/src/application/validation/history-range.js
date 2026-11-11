import { ApplicationError } from "../../domain/errors/application-error.js";

const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000;

export function validateHistoryRange({ from, to }) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to || to - from > MAX_RANGE_MS)
    throw new ApplicationError("invalid_time_range", 400, "from and to must be valid and within 90 days");
  return { from, to };
}
