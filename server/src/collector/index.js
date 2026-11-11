/** Scheduler entry point. Exchange adapters are registered here as they are implemented. */
export async function collectScheduled(_env) {
  // Each exchange will be isolated with its own timeout and failure record. A failed
  // fetch must leave latest_quotes untouched so callers keep seeing the last good quote.
  console.info("collector: no exchange adapters configured yet");
}
