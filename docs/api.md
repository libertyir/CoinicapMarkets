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

## TradingView UDF datafeed

| Route | Purpose |
|---|---|
| `GET /api/v1/charting/config` | UDF capabilities and supported resolutions. |
| `GET /api/v1/charting/search?query=BTC` | Search canonical market symbols. |
| `GET /api/v1/charting/symbols?symbol=BTCTMN` | Symbol metadata and enabled intervals. |
| `GET /api/v1/charting/history?symbol=BTCTMN&resolution=5&from=MS&to=MS&exchange=nobitex` | UDF candle history; omit exchange to aggregate enabled exchanges. |

History resolution codes are `5`, `15`, `60`, and `1D`; responses follow TradingView UDF (`s,t,o,h,l,c,v`). A row represents the latest collected revision of each source candle per exchange; cross-exchange bars average open/close, use max high/min low, and sum volume. The collector must populate source candle timestamps and OHLCV before this endpoint can return bars. No streaming endpoint is provided yet; chart refresh is polling/history-only.

## Authentication

`GET /health`, `POST /api/v1/auth/bootstrap`, and `POST /api/v1/auth/login` are public. Bootstrap accepts `username`, `password`, and `setupKey`; configure `ADMIN_SETUP_KEY` as a Worker secret first. It succeeds only while no admin exists. Login returns a 30-day bearer token. Passwords use PBKDF2-SHA-256 with per-user random salt; only SHA-256 token hashes are stored. Never commit `ADMIN_SETUP_KEY` or bearer tokens.

Data API route policies are individual and default to private when no policy row exists. The initial bootstrap makes catalog, quote, aggregate, index, and charting endpoints public. An admin can manage them with `GET /api/v1/admin/access-policies` and `PATCH /api/v1/admin/access-policies/{route_key}` using `{ "is_public": false, "enabled": true }`. Known keys include `quotes.latest`, `quotes.series`, `indices.latest`, and `charting.history`. Disabled routes return 404. Private read routes require a valid token with `read` scope; admin tokens also include `read` and `admin`.

Admin-only account management: `GET/POST /api/v1/admin/users` lists users or creates a reader/admin account; the response returns its initial token once. `GET /api/v1/admin/tokens` lists token metadata without secrets; `POST /api/v1/admin/tokens/{id}/revoke` revokes one. Access-policy and account APIs cannot be made public through policy settings. The scheduled collector remains internal; there is no public ingest route.
