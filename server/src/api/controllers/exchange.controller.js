import { cached } from "./http.js";

export function listExchanges(request, app) {
  return cached(request, () => app.exchanges.list());
}
