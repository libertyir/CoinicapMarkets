# Database design

The complete fresh-database schema is in `server/db/bootstrap.sql`. Before pilot, keep this as the only setup script; do not create or apply migrations. Never run it against retained data. After pilot begins, ask before schema, retention, cleanup, deletion, or backfill work and prepare a migration/backup plan.

## Entities and configuration

| Table | Domain | Purpose |
|---|---|---|
| `assets` | Asset | A coin or currency such as BTC, USDT, USDC, DAI, or TMN. Includes type and Persian/English names. |
| `markets` | Pair | A canonical base/quote pair, such as `BTCTMN`. It references two assets and has bilingual display names. |
| `exchanges` | Exchange | Stable venue identity, CEX/OTC/Hybrid type, enabled flag, display order, descriptions, links, and support metadata. |
| `exchange_contacts` | Exchange | Multiple optional public contact methods with bilingual labels. |
| `exchange_markets` | Exchange pair | Maps a canonical pair to the exact venue-native symbol. A venue pair can be disabled independently. |
| `exchange_api_endpoints` | API provider | Dynamic method, URL, headers/query/body templates, response mapping, auth mode, rate and timeout settings. Secret values never live here. |
| `exchange_market_timeframes` | Pair collection | Selects the endpoint and venue-specific interval for each exchange pair and output timeframe. |
| `index_definitions` | Price index | Defines an index pair such as `USDTTMN` or `DAITMN`, its direct market, calculation method and bilingual names. |
| `index_definition_components` | Price index | Selects each component coin and its numerator/denominator canonical pairs. |
| `timeframes` | Time | Normalized periods such as 5m, 15m, and 1h. |
| `users` / `api_tokens` | Access | Login identities, roles, revocable bearer tokens, scopes and expiry. No default credentials are inserted. |

The three pair identifiers remain distinct:

1. `markets.code` is our public canonical pair (for example `BTCTMN`).
2. `exchange_markets.native_symbol` is the symbol used by one exchange (for example `btc-Toman`).
3. `exchange_market_timeframes` selects how that pair is requested and which exchange interval maps to our timeframe.

This means the same asset can have many pairs, and each exchange can have a different native symbol and API request mapping. Adding or disabling an asset, pair, venue mapping, or index is configuration data; it must not require new calculation code.

## Raw and calculated history

`market_data_samples` stores each collector observation, including `price`, `open_price`, `close_price`, `volume`, quote-turnover `value`, `top_price`, `low_price`, source timeframe/timestamps, collection time, canonical pair, and native symbol. Numeric values are decimal strings. `value` uses a venue-reported quote turnover, or `price × base-volume` only when the adapter has verified the volume unit.

`computed_market_samples` stores the all-venue and CEX/OTC aggregate snapshots. `price`, `open_price`, and `close_price` are arithmetic means; aggregate `high_price`/`low_price` are the maximum/minimum current exchange `price`; `volume` and `value` sum only compatible units. It records contributor count and oldest/newest input times.

`price_index_component_samples` stores each per-exchange, per-asset cross-rate and the two exact source sample IDs. `price_index_samples` stores the per-exchange index plus equally weighted CEX, OTC, and all-venue index records. Each calculated record is historical; a fresh read endpoint returns the latest record.

For an index with target pair `INDEX_BASE/INDEX_QUOTE`, each configured component calculates:

`BASE/INDEX_QUOTE ÷ BASE/INDEX_BASE`

For example, the `USDTTMN` definition uses `BTC/TMN ÷ BTC/USDT`; a future `DAITMN` definition can use `BTC/TMN ÷ BTC/DAI`. The service averages available component rates within each exchange, then equally averages per-exchange indices by CEX, OTC, or all venues. High/Low for a component use conservative OHLC bounds because the two source candles do not reveal whether their extrema happened at the same moment. Index `value` sums the contributing numerator-market quote turnovers; index `volume` is omitted because the index has no single base asset.

The recomputation service uses fresh samples no older than six minutes to allow small Cron delays beyond the five-minute collection interval. Stale data stays in raw history but is excluded from current aggregates.

## Layer boundaries

Server code is split into `domain/entities`, pure `domain/providers`, `infrastructure/repositories` for D1 queries, `application/services` for use cases, and `api/controllers` for HTTP parsing/response mapping. `api/router.js` only dispatches requests and applies cross-cutting HTTP behavior. Keep every source file under 500 lines.

## API settings and security

`response_field_map_json` maps simple JSON paths to canonical fields. Request templates use only documented placeholders such as `{native_symbol}` and `{source_interval}`; never execute code from configuration. Only allow HTTPS hosts approved for that exchange, and reject local/private-network targets or redirects. API keys/passwords remain Cloudflare secrets; `secret_refs_json` stores references only.

The intended API contract requires bearer tokens except `/health` and login/token issuance. Read and admin scopes are separate; all configuration writes require admin authorization. The scheduled collector writes internally and has no public ingestion route. Authentication and configuration CRUD are not yet implemented in the Worker, so do not expose write endpoints until they are.
