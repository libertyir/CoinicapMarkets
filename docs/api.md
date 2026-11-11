# API contract

Routes use `/api/v1`, return JSON, and cache GET responses for five minutes. Price/volume fields are decimal strings. `market` is always our canonical pair code; `exchange_symbol` is the venue-native symbol. Exchange type and dynamic labels are returned with Persian and English fields.

## Catalog and market data

| Route | Purpose |
|---|---|
| `GET /health` | Liveness check; no database or exchange calls. |
| `GET /api/v1/exchanges` | Enabled venues, CEX/OTC/Hybrid type, bilingual names and public contacts. |
| `GET /api/v1/assets` | Enabled coins/currencies, type and localized labels. |
| `GET /api/v1/markets` | Canonical pairs, base/quote assets and bilingual display names. |
| `GET /api/v1/exchange-markets?exchange=...&market=...` | Venue pair mapping: native symbol, endpoint template/mapping and timeframe interval. Secret references and credentials are not returned. |
| `GET /api/v1/timeframes?exchange=...&market=...` | Supported output timeframes; filters are optional. |
| `GET /api/v1/quotes/latest?exchange=...&market=...&timeframe=...` | Latest raw sample per exchange pair/timeframe. Filters are optional. |
| `GET /api/v1/quotes/series?exchange=...&market=...&timeframe=15m&from=MS&to=MS` | Raw sample history; maximum range 90 days and 20,000 rows. |
| `GET /api/v1/aggregates/latest?market=BTCTMN&timeframe=5m&type=cex` | Latest aggregate. Omit `type` to receive all, CEX and OTC groups. |
| `GET /api/v1/aggregates/series?market=BTCTMN&timeframe=5m&type=cex&from=MS&to=MS` | Stored aggregate history, up to 90 days. Omit `type` to receive every scope. |

## Configurable indices

| Route | Purpose |
|---|---|
| `GET /api/v1/indices` | Enabled index definitions and component pair mappings. |
| `GET /api/v1/indices/{code}?timeframe=5m&type=cex` | One index, direct market comparison and gap. `type` is optional; `exchange` can select a venue. |
| `GET /api/v1/indices/{code}/components?timeframe=5m&type=cex` | Latest implied rate for each configured component coin, with both source sample times. |
| `GET /api/v1/indices/{code}/exchanges?timeframe=5m` | Latest index for each venue, including CEX/OTC type. |
| `GET /api/v1/indices/{code}/series?timeframe=5m&type=cex&from=MS&to=MS` | Stored index history with direct-market prices and calculated gap. Use `exchange=...` to select one venue instead of a type. |

`USDTTMN` is the initial definition. The older `/api/v1/estimates/usdt-tmn` paths remain aliases for that code. A later `DAITMN` index is added by creating a definition and selecting the numerator/denominator pairs for its components; the calculation provider remains unchanged.

Each component computes `BASE/INDEX_QUOTE ÷ BASE/INDEX_BASE` within one exchange and timeframe. For example, the BTC component of `USDTTMN` is `BTCTMN / BTCUSDT`; the BTC component of `DAITMN` is `BTCTMN / BTCDAI`. The service averages configured coin components within each exchange, then equally averages each venue's index for CEX, OTC, and all scopes.

Market aggregate fields: `price`, `open_price`, and `close_price` are arithmetic means. `high_price`/`low_price` are the maximum/minimum current exchange `price`. `volume`/`value` are sums only when their units match. Index `high_price`/`low_price` are the max/min component implied current rates. Per-component OHLC bounds use numerator high ÷ denominator low, and numerator low ÷ denominator high because candle OHLC does not expose exact extreme times. Index `value` sums quote turnover from the numerator pairs; index `volume` is omitted because an index has no single base asset. `gap_percent = (index - direct_market) / direct_market × 100`.

`market_data_samples` preserves every observation; `computed_market_samples`, `price_index_component_samples`, and `price_index_samples` preserve calculated history. Only inputs collected within six minutes are used in a current recomputation. Component rows include source IDs/timestamps so consumers can audit freshness.

## Authentication

The intended contract requires `Authorization: Bearer <token>` for API data and configuration calls except `/health` and login/token issuance. Read scope permits data access; admin scope permits configuration changes. The current router has not implemented login, token validation, or write routes yet. Do not treat the API as authenticated and do not expose writable routes before access checks are implemented. The collector writes internally; there is no public data-ingest endpoint.
