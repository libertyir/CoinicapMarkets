# Database design

The complete fresh-database schema is in `server/db/bootstrap.sql`. Before pilot, maintain that single setup script in place; do not create or apply migrations. Never execute it against a database with retained data. After the owner explicitly starts the pilot, ask before any schema, cleanup, retention, delete, or backfill operation and propose a migration/backup plan first.

## Identity and configuration

| Table | Purpose |
|---|---|
| `exchanges` | Stable exchange identity, enabled state, order, adapter key, description, website, docs, support and status links. |
| `exchange_contacts` | Multiple typed contact methods, each optionally public. |
| `assets` | Canonical coin/currency registry. |
| `markets` | Product-owned output symbol and canonical base/quote assets, e.g. `BTCTMN`. |
| `exchange_markets` | Maps a canonical market to the venue's `native_symbol` (e.g. `btc-Toman`). It can be disabled per venue. |
| `exchange_api_endpoints` | Dynamic HTTP method/path, headers/query/body templates, response paths/field mappings, timeout, polling and secret references. One exchange may have multiple endpoints. |
| `timeframes` | Product-owned normalized periods such as `5m`, `15m`, and `1h`. Add new periods as rows. |
| `exchange_market_timeframes` | Maps each exchange-market and output timeframe to its endpoint and venue-native interval code. |

The three symbols must remain separate:

1. `markets.code` is the stable public/API symbol (`BTCTMN`).
2. `exchange_markets.native_symbol` is the exact venue symbol (`btc-Toman`, `BTCTMN`, etc.).
3. API responses expose the stable output symbol as `market`; `exchange_symbol` is optional provenance and must never replace it.

## Time-series data

`market_data_samples` stores one snapshot each time the collector polls an exchange-market timeframe. `collected_at_ms` is our sample time; `source_open_time_ms` / `source_close_time_ms` describe the exchange candle. Therefore polling every 5 minutes can store several evolving snapshots of the same 15-minute or 1-hour candle. Collection cadence and candle timeframe are distinct fields/settings.

Fields: `price`, `open_price`, `close_price`, `volume`, `top_price`, `low_price`, venue-native interval, source timestamps, sample timestamp, canonical output symbol, and native symbol as used at collection time. Store numeric values as decimal text. `price` is the price value reported for that sampled bar; if an API only supplies OHLCV, the adapter maps it to that candle's close. `top_price` means candle high. Volume units must be documented by each adapter (normally the base asset).

`collection_runs` records collector health. The bootstrap contains only the final initial schema; it does not create the obsolete v1 `observations` or `latest_quotes` tables.

## Dynamic endpoint format

`response_field_map_json` maps normalized fields to simple JSON paths, e.g. `{ "price": "data.close", "open": "data.open", "volume": "data.volume", "top_price": "data.high", "low_price": "data.low", "source_open_time_ms": "data.start" }`. Request templates may substitute only documented values such as `{native_symbol}` and `{source_interval}`. Never store executable JavaScript or secret values in D1. `secret_refs_json` holds Cloudflare secret names/references, not their values. Validate endpoint paths against each configured HTTPS API base URL.

Suggested future tables (only when needed): rollup candles for compact long-term history, API-client credentials/rate plans, and versioned `forecast_runs`/`forecasts` isolated from observations.
