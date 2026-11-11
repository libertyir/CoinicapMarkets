# Public API (initial contract)

Read-only routes use `/api/v1`, return JSON, and cache GET responses for five minutes. Decimal fields are strings. `market` always means our canonical output symbol (for example `BTCTMN`); `exchange_symbol` is the exchange's native symbol. `timeframe` is our normalized frame code, while `source_interval_code` preserves the exchange's interval name.

| Route | Behavior |
|---|---|
| `GET /api/v1/exchanges` | Enabled exchange directory. Public contact fields only. |
| `GET /api/v1/markets` | Enabled canonical markets and base/quote assets. |
| `GET /api/v1/timeframes?exchange=...&market=...` | Enabled timeframes supported by configured exchange-market mappings. Filters are optional. |
| `GET /api/v1/quotes/latest?exchange=...&market=...&timeframe=...` | Latest collected sample per exchange-market-timeframe. Filters are optional. |
| `GET /api/v1/quotes/series?exchange=...&market=...&timeframe=15m&from=MS&to=MS` | Sample history for one exchange, canonical market, and timeframe. Maximum range 90 days / 20,000 rows. |
| `GET /api/v1/estimates/usdt-tmn` | Planned direct/estimated rate comparison; currently returns `not_configured`. |
| `GET /health` | Liveness only; does not query an exchange. |

Quote/bar rows contain `price`, `open_price`, `close_price`, `volume`, `top_price`, `low_price`, `timeframe`, `source_interval_code`, `source_open_time_ms`, `source_close_time_ms`, `source_time_ms`, `collected_at_ms`, and `age_ms`. `top_price` is the high of the exchange candle. If a venue does not return an independent `price`, use its sampled candle close. The API preserves decimal strings; clients should not parse them through binary floating point for calculations.

The collector cadence is separate from the bar timeframe. For example, a `15m` venue candle can be sampled every 5 minutes; repeated observations of that same source candle are intentionally preserved with different `collected_at_ms` values.

The future USDT/TMN estimate should expose direct quote, estimated quote, gap %, formula/version, input markets and venues, data age, and quality flags. Do not label it as a working or executable arbitrage result until adapters and methodology are implemented.
