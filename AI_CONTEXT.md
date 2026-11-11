# AI Project Context — CoinicapMarkets

This file is the handoff memory for any AI or contributor continuing this project. Read it before making changes.

## Owner workflow and non-negotiable rules

1. **GitHub is the source of truth.** Make and review the change against `libertyir/CoinicapMarkets` first. After the GitHub commit/update succeeds, sync the local checkout to the exact `main` state before finishing.
2. **Keep every source/code file at or below 500 lines.** Split modules, helpers, adapters, and classes before a file approaches the limit. Do not solve growth by compressing or minifying code.
3. **Keep this context file current** when architecture, decisions, deployment, or project status materially changes. It is intentionally a concise handoff, not a full specification.
4. Use plain JavaScript for the backend (no TypeScript). The owner knows C#, Python, JavaScript, Delphi Pascal, ASP.NET, and PHP; prefer JavaScript here because the current target is Cloudflare Workers and the client is JavaScript.
5. **Before the pilot, maintain one fresh-database setup script only.** Do not add/apply migrations or initialize local/remote persistent databases until the owner explicitly starts the pilot.
6. Ask before work that changes or relies on retained data (schema after pilot, retention, deletion, cleanup, backfill, or remote database operations). Ordinary code, docs, and UI edits do not need confirmation.

## Product

CoinicapMarkets collects public market data from 2–5 Iranian exchanges every five minutes and exposes a read-only aggregated API plus a separate browser UI. Initial canonical output markets:

`BTCTMN`, `BTCUSDT`, `ETHUSDT`, `ETHTMN`, `BNBTMN`, `BNBUSDT`, `TRXUSDT`, `TRXTMN`, `USDTTMN`, `USDCTMN`.

Planned features include exchange/market price comparisons, cross-market gaps, direct vs estimated USDT/TMN, historical data, and possibly forecasts. Forecasts must remain distinct from observations.

## Architecture

- `server/`: JavaScript Cloudflare Worker API and scheduled collector.
- `client/`: independent static HTML + plain JavaScript + Bootstrap RTL UI. It calls the server only through REST/JSON and reads the API URL from `client/config.js`.
- `docs/`: architecture, schema, API/OpenAPI, and deployment documentation.
- Cloudflare Cron Trigger runs the collector every 5 minutes (UTC). Only the collector calls exchange APIs; user API requests never call an exchange.
- D1/SQLite is the source of truth. Cache API and a bounded isolate-local Map cache GET responses for 300 seconds. A cache miss reads D1 only. Edge/memory caches are best-effort and may miss after eviction, isolate restart, or in another location.
- Each collector poll stores `price`, `open_price`, `close_price`, `volume`, `top_price`, and `low_price`. A 5-minute polling cadence is distinct from the exchange candle timeframe (e.g. 15m or 1h); repeated snapshots of one source candle are preserved.
- Store prices as decimal strings. Preserve source and collection timestamps. On exchange/API failures, retain the last good quote and record diagnostics.
- UI and API deploy separately; configure CORS for the client origin when moving beyond the current public read-only prototype.

## Data model

The single pre-pilot setup script is `server/db/bootstrap.sql`. It creates the final initial schema: `exchanges`, `exchange_contacts`, `assets`, `markets`, `exchange_markets`, `exchange_api_endpoints`, `timeframes`, `exchange_market_timeframes`, `market_data_samples`, and `collection_runs`. No migrations exist or should be created before the owner says pilot.

Keep three identifiers distinct: canonical output symbol in `markets.code` (e.g. `BTCTMN`), venue-native pair in `exchange_markets.native_symbol` (e.g. `btc-Toman`), and normalized output timeframe vs `source_interval_code`. `market_data_samples` records `collected_at_ms` separately from source candle open/close times. Numeric values remain decimal strings. Verify quote/volume units and whether TMN means toman or rial; never assume.

Endpoint configuration is declarative: method, path, headers/query/body templates, JSON item/field paths, timeframe mapping, timeout, and polling interval are database rows. Never evaluate arbitrary code from config. Keep secret values out of D1/GitHub; store Cloudflare secret references only.

## Current state on GitHub

- Public repository: https://github.com/libertyir/CoinicapMarkets
- Main branch contains the JavaScript backend/static-client restructure and GPL-3.0 license retained from the repository.
- Database bootstrap is intentionally deferred; `server/db/bootstrap.sql` is the sole initial schema source and has not been run.
- The backend routes and UI are starter scaffolding. **No real exchange adapter/collector is active yet.**
- `GET /api/v1/estimates/usdt-tmn` currently returns `not_configured`; do not describe it as a working estimate.
- API routes: `/api/v1/exchanges`, `/api/v1/markets`, `/api/v1/timeframes`, `/api/v1/quotes/latest`, `/api/v1/quotes/series`, `/api/v1/estimates/usdt-tmn`, and `/health`.
- Cloudflare database ID is a placeholder in `server/wrangler.jsonc`. No Cloudflare deployment is configured yet.

## Next required decisions/work

1. Ask which 2–5 exchanges to support first; verify official public API docs, native pair symbols, OHLCV semantics, candle-frame codes, quote/volume units, request limits, and Cloudflare reachability.
2. Implement the generic configurable REST/JSON collector and a small custom adapter per exceptional venue; keep orchestration, persistence, API routing, and estimation separate.
3. Implement atomic observation + latest-quote updates, per-exchange failure tracking, and a real USDT/TMN estimate with transparent inputs/age/quality flags.
4. Add retention/rollups before history grows; then improve the client UI and publish the complete API docs.
5. Deploy only after account/database IDs and verified adapters are available. Never commit secrets.
