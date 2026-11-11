# API (initial contract)

Routes use `/api/v1`, return JSON, and cache GET responses for five minutes. Decimal fields are strings. `market` always means our canonical output symbol (for example `BTCTMN`); `exchange_symbol` is the exchange's native symbol. `timeframe` is our normalized frame code, while `source_interval_code` preserves the exchange's interval name. Exchange, asset, market, and contact metadata carries Persian and English fields; UI text is selected with the client language setting.

## Authentication contract

Except `/health` and login/token issuance, CoinicapMarkets API calls require `Authorization: Bearer <access-token>`. Login returns a short-lived token; a signed-in user can issue and revoke longer-lived API tokens with scopes. `read` permits data reads, while `admin` permits exchange, endpoint, market, timeframe, and contact configuration. Only an administrator may grant scopes. Passwords and raw tokens are never returned after creation; D1 stores salted password hashes and token hashes. The scheduled collector writes internally and has no public ingestion endpoint. Browser code must never contain an admin token.

The current router is still a read-only scaffold and does not enforce this auth contract yet. Implement login, bearer-token validation, scope checks, and configuration routes before pilot or before exposing writable API endpoints. Until then, do not treat the API as authenticated.

| Route | Behavior |
|---|---|
| `GET /api/v1/exchanges` | Enabled exchange directory. Public contact fields only. |
| `GET /api/v1/markets` | Enabled canonical markets and base/quote assets. |
| `GET /api/v1/timeframes?exchange=...&market=...` | Enabled timeframes supported by configured exchange-market mappings. Filters are optional. |
| `GET /api/v1/quotes/latest?exchange=...&market=...&timeframe=...` | Latest collected sample per exchange-market-timeframe. Filters are optional. |
| `GET /api/v1/quotes/series?exchange=...&market=...&timeframe=15m&from=MS&to=MS` | Sample history for one exchange, canonical market, and timeframe. Maximum range 90 days / 20,000 rows. |
| `GET /api/v1/aggregates/latest?market=BTCTMN&timeframe=5m&type=cex` | Latest cross-exchange price aggregates. Omit `type` to return all venues and the CEX/OTC groups. |
| `GET /api/v1/estimates/usdt-tmn?timeframe=5m&type=cex` | Derived USDT/TMN index compared with the direct `USDTTMN` aggregate and their percentage gap. `type` may be `cex` or `otc`; omit it for all venues; `exchange=nobitex` requests one venue's index. |
| `GET /api/v1/estimates/usdt-tmn/components?timeframe=5m&type=cex` | Per-exchange, per-asset implied rates and the source sample times. Optional `exchange` filters one venue. |
| `GET /api/v1/estimates/usdt-tmn/exchanges?timeframe=5m` | Latest USDT/TMN index for each exchange, including its CEX/OTC type. |
| `GET /health` | Liveness only; does not query an exchange. |

Quote/bar rows contain `price`, `open_price`, `close_price`, `volume`, `value`, `top_price`, `low_price`, `timeframe`, `source_interval_code`, `source_open_time_ms`, `source_close_time_ms`, `source_time_ms`, `collected_at_ms`, and `age_ms`. `top_price` is the high of the exchange candle. If a venue does not return an independent `price`, use its sampled candle close. The API preserves decimal strings; clients should not parse them through binary floating point for calculations.

Market aggregate fields: `price` = arithmetic mean of fresh exchange prices; `high_price`/`low_price` = maximum/minimum of those exchange prices; `open_price`/`close_price` = arithmetic means; `volume`/`value` = sums in the canonical market's base/quote units. Aggregate rows are stored for `all`, `cex`, and `otc` scopes where data exists.

For each same-exchange, same-timeframe base asset with both a `BASE/TMN` and `BASE/USDT` market, the implied rate is `BASE/TMN ÷ BASE/USDT`. The exchange index is the arithmetic mean of available coin rates. CEX/OTC/all indices average per-exchange indices equally. High/Low on an index describe the highest/lowest constituent current implied rate; per-coin OHLC bounds use Toman high ÷ USDT low and Toman low ÷ USDT high. The index `value` sums the quote turnover from the contributing Toman-side markets. Component responses expose both source sample timestamps so clients can inspect freshness.

The collector cadence is separate from the bar timeframe. For example, a `15m` venue candle can be sampled every 5 minutes; repeated observations of that same source candle are intentionally preserved with different `collected_at_ms` values.

USDT/TMN estimate rows expose the direct aggregate, derived index, `gap_percent = (index - direct) / direct × 100`, formula version, and quality flags. Until adapters and the scheduled recomputation are active, stored aggregate/index tables will be empty and the estimate status will be `no_data`; do not treat it as a working or executable arbitrage result.
