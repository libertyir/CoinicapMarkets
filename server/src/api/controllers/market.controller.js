import { cached } from "./http.js";

export function listAssets(request, app) {
  return cached(request, () => app.markets.listAssets());
}

export function listPairs(request, app) {
  return cached(request, () => app.markets.listPairs());
}

export function listTimeframes(request, app) {
  const url = new URL(request.url);
  return cached(request, () => app.markets.listTimeframes({
    exchange: url.searchParams.get("exchange"),
    market: url.searchParams.get("market"),
  }));
}

export function listExchangePairs(request, app) {
  const url = new URL(request.url);
  return cached(request, () => app.markets.listExchangePairs({
    exchange: url.searchParams.get("exchange"),
    market: url.searchParams.get("market"),
  }));
}
