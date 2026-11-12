import { cached, json } from "./http.js";

const RESOLUTIONS = new Map([["5", "5m"], ["15", "15m"], ["60", "1h"], ["1D", "1d"]]);

export function chartConfig() {
  return json({
    supported_resolutions: [...RESOLUTIONS.keys()],
    supports_search: true,
    supports_group_request: false,
    supports_marks: false,
    supports_timescale_marks: false,
    supports_time: false,
  });
}

export async function chartSymbols(request, app) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol")?.toUpperCase();
  if (!symbol) return json({ s: "error", errmsg: "symbol is required" }, 400);
  const rows = await app.quotes.chartSymbols(symbol);
  const matches = rows.filter((row) => row.symbol === symbol);
  if (!matches.length) return json({ s: "error", errmsg: "unknown_symbol" }, 404);
  return json({
    name: symbol, ticker: symbol, description: matches[0].description || symbol,
    type: "crypto", session: "24x7", timezone: "Etc/UTC", exchange: "CoinicapMarkets",
    minmov: 1, pricescale: 100000000, has_intraday: true, has_daily: true,
    has_weekly_and_monthly: false, supported_resolutions: [...new Set(matches.map((row) =>
      ({ "5m": "5", "15m": "15", "1h": "60", "1d": "1D" })[row.timeframe]
    ).filter(Boolean))], volume_precision: 8, data_status: "endofday",
  });
}

export async function chartSearch(request, app) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("query") || "").toUpperCase();
  const rows = await app.quotes.chartSymbols(query);
  const unique = [...new Set(rows.map((row) => row.symbol))];
  return json(unique.map((symbol) => ({
    symbol, full_name: `CoinicapMarkets:${symbol}`, description: symbol,
    exchange: "CoinicapMarkets", ticker: symbol, type: "crypto",
  })));
}

export async function chartHistory(request, app) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol")?.toUpperCase();
  const timeframe = RESOLUTIONS.get(url.searchParams.get("resolution"));
  const from = Number(url.searchParams.get("from"));
  const to = Number(url.searchParams.get("to"));
  if (!symbol || !timeframe || !Number.isFinite(from) || !Number.isFinite(to) || from > to)
    return json({ s: "error", errmsg: "invalid symbol, resolution, from or to" }, 400);
  try {
    return await cached(request, async () => {
      const rows = await app.quotes.chartBars({
        symbol, resolution: timeframe, from, to,
        exchange: url.searchParams.get("exchange"),
      });
      if (!rows.length) return { s: "no_data" };
      return { s: "ok", t: rows.map((r) => r.time), o: rows.map((r) => r.open),
        h: rows.map((r) => r.high), l: rows.map((r) => r.low),
        c: rows.map((r) => r.close), v: rows.map((r) => r.volume ?? 0) };
    });
  } catch (error) {
    return json({ s: "error", errmsg: error.message || "history_unavailable" }, error.status || 500);
  }
}
