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
- Each collector poll stores `price`, `open_price`, `close_price`, `volume`, quote-turnover `value`, `top_price`, and `low_price`. A 5-minute polling cadence is distinct from the exchange candle timeframe (e.g. 15m or 1h); repeated snapshots of one source candle are preserved.
- Store prices as decimal strings. Preserve source and collection timestamps. On exchange/API failures, retain the last good quote and record diagnostics.
- UI and API deploy separately; configure CORS for the client origin when moving beyond the current public read-only prototype.
- Every visible client string needs Persian and English translations. Switch both `lang` and page direction (`rtl`/`ltr`); server metadata includes paired `*_fa` / `*_en` fields.
- Initial exchange directory: Nobitex, Wallex, and Bitpin are labeled CEX; VisaPay is labeled OTC per owner. Store this as dynamic `exchange_type` (`cex`, `otc`, `hybrid`) and return it through the exchange and quote APIs. The initial UI has a Persian/English toggle.
- CoinicapMarkets API access contract: login issues bearer tokens; read scope is for data access, admin scope is required for configuration writes. Store only salted password hashes and API-token hashes; no default credentials. Collector writes are internal to the scheduled Worker. Do not put admin tokens in browser code.
- Derived market aggregates: `price`/`open_price`/`close_price` are arithmetic means; aggregate `high_price`/`low_price` are max/min of fresh exchange `price`; `volume`/`value` sum compatible units. Save all/CEX/OTC snapshots after successful collection.
- Price indices are data-driven: `index_definitions` selects the target pair and `index_definition_components` selects numerator/denominator pairs. `USDTTMN` is seeded; `DAITMN` or another index can be added without changing the provider. For each component calculate `BASE/INDEX_QUOTE ÷ BASE/INDEX_BASE`, average components per exchange, then equally average exchanges by CEX/OTC/all. High/low are max/min constituent rates; per-component OHLC bounds are conservative. Index `value` sums numerator quote turnover. Skip stale/missing pairs; six-minute max age allows Cron jitter.

## Data model

The single pre-pilot setup script is `server/db/bootstrap.sql`. It creates the initial schema: `assets`, `markets`, `exchanges`, `exchange_contacts`, `exchange_markets`, `exchange_api_endpoints`, `exchange_market_timeframes`, `timeframes`, `index_definitions`, `index_definition_components`, `market_data_samples`, `computed_market_samples`, `price_index_component_samples`, `price_index_samples`, `collection_runs`, `users`, and `api_tokens`. It seeds the four exchange directory records and a configurable `USDTTMN` index, but no unverified native symbols/endpoints and no credentials. No migrations exist or should be created before the owner says pilot.

Keep three identifiers distinct: canonical output symbol in `markets.code` (e.g. `BTCTMN`), venue-native pair in `exchange_markets.native_symbol` (e.g. `btc-Toman`), and normalized output timeframe vs `source_interval_code`. `market_data_samples` records `collected_at_ms` separately from source candle open/close times. Numeric values remain decimal strings. Verify quote/volume units and whether TMN means toman or rial; never assume.

Endpoint configuration is declarative: method, path, headers/query/body templates, JSON item/field paths, timeframe mapping, timeout, and polling interval are database rows. Never evaluate arbitrary code from config. Keep secret values out of D1/GitHub; store Cloudflare secret references only.

## Current state on GitHub

- Public repository: https://github.com/libertyir/CoinicapMarkets
- Main branch contains the JavaScript backend/static-client restructure and GPL-3.0 license retained from the repository.
- Database bootstrap is intentionally deferred; `server/db/bootstrap.sql` is the sole initial schema source and has not been run.
- The backend routes and UI are starter scaffolding. **No real exchange adapter/collector is active yet.**
- Client UI supports Persian/English toggle and displays exchange type. Read API fields expose bilingual venue metadata. Authentication/token schema and contract are documented, but the current router still does not enforce auth; implement before pilot or any write routes.
- Server layers are `domain/entities`, pure `domain/providers`, `infrastructure/repositories`, `application/services`, and `api/controllers`; `api/router.js` only dispatches. The D1-backed recomputation runs through `DerivedDataService`, `MarketAggregateProvider`, and `CrossRateIndexProvider`. Generic index APIs/UI support all enabled definitions. No adapter calls recomputation yet because no real collector is active; expect `no_data` until samples are ingested.
- Official API research is recorded in `docs/exchange-api-configuration.md`: Nobitex, Wallex and Bitpin have public market data endpoints; VisaPay website displays live OTC quote/market information but no public developer API docs were found. Do not scrape VisaPay; request their official integration API before enabling collection.
- `/api/v1/estimates/usdt-tmn` is a legacy alias to configurable index code `USDTTMN`. The generic route returns `no_data` until collector samples and recomputed rows exist; do not describe an empty estimate as a working quote.
- Read APIs are split by section: `/api/v1/exchanges`, `/api/v1/assets`, `/api/v1/markets`, `/api/v1/exchange-markets`, `/api/v1/timeframes`, `/api/v1/quotes/latest`, `/api/v1/quotes/series`, `/api/v1/aggregates/latest`, `/api/v1/aggregates/series`, `/api/v1/indices`, `/api/v1/indices/{code}`, `/api/v1/indices/{code}/components`, `/api/v1/indices/{code}/exchanges`, `/api/v1/indices/{code}/series`, and `/health`. Historical endpoints enforce a 90-day range. Legacy `estimates/usdt-tmn` paths alias index code `USDTTMN`.
- Cloudflare database ID is a placeholder in `server/wrangler.jsonc`. No Cloudflare deployment is configured yet.

## Next required decisions/work

1. Implement login/bearer-token validation, scope checks, and authenticated CRUD APIs for assets, pairs, exchange mappings, endpoints, and index definitions/components before pilot.
2. Verify venue-specific native pair symbols, OHLCV semantics, candle-frame codes, quote/volume units, request limits, and Cloudflare reachability; get VisaPay integration docs before its collector can be enabled.
3. Implement the generic configurable REST/JSON collector and small custom adapters for exceptions; keep orchestration, repositories, services, controllers, and providers separate.
4. Connect `DerivedDataService.recompute` after successful fetch batches; implement atomic raw sample writes, per-exchange failure tracking, and index quality flags.
5. Add retention/rollups before history grows; complete bilingual UI/docs; deploy only after IDs and verified adapters are available. Never commit secrets.
