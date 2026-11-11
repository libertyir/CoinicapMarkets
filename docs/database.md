# Database schema

Migration: `server/migrations/0001_initial.sql`. Monetary values are stored as decimal **text** to avoid rounding from JavaScript floating-point arithmetic. API clients should receive the original decimal string.

| Table | Purpose |
|---|---|
| `exchanges` | Exchange identity, adapter key, enabled flag, and display order. |
| `assets` | Canonical coin/currency registry (BTC, ETH, USDT, TMN, etc.). |
| `markets` | Canonical pair definition: base asset + quote asset; enabled and display settings. |
| `exchange_markets` | Maps a canonical market to an exchange's native symbol and adapter options. Toggle a pair at one venue independently. |
| `observations` | Append-only historical samples keyed by mapping and collection time. |
| `latest_quotes` | One last-known-good quote per exchange-market for the hot API path. |
| `collection_runs` | Success/partial/failure diagnostics per exchange run. |
| `schema_migrations` | Applied migration bookkeeping for future releases. |

Initial canonical markets can be seeded from `BTCTMN`, `BTCUSDT`, `ETHUSDT`, `ETHTMN`, `BNBTMN`, `BNBUSDT`, `TRXUSDT`, `TRXTMN`, `USDTTMN`, and `USDCTMN`. Actual exchange-native symbols must be mapped separately.

Suggested next migrations (when needed): `hourly_candles` for long-term compact history, `api_keys`/`api_clients` for metered public API access (store only hashes), and `forecast_runs` + `forecasts` for prediction features. Avoid adding them until there is a concrete feature requirement.
