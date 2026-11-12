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

`GET /health`, `POST /api/v1/auth/bootstrap`, and `POST /api/v1/auth/login` are public. Bootstrap accepts `username`, `password`, and `setupKey`; configure `ADMIN_SETUP_KEY` as a Worker secret first. It succeeds only while no admin exists. Login returns a 30-day bearer token. Passwords use PBKDF2-SHA-256 with per-user random salt; only SHA-256…1939 tokens truncated…n  updated_at_ms INTEGER NOT NULL,
  UNIQUE(exchange_id, market_id),
  UNIQUE(exchange_id, native_symbol)
);

-- Declarative API settings; secret values belong in Cloudflare secrets, never in D1.
CREATE TABLE IF NOT EXISTS exchange_api_endpoints (
  id INTEGER PRIMARY KEY,
  exchange_id INTEGER NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  endpoint_key TEXT NOT NULL,
  auth_mode TEXT NOT NULL DEFAULT 'none' CHECK (auth_mode IN ('none', 'api_key', 'bearer', 'custom')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  http_method TEXT NOT NULL DEFAULT 'GET' CHECK (http_method IN ('GET', 'POST')),
  url_template TEXT NOT NULL,
  headers_json TEXT NOT NULL DEFAULT '{}',
  query_template_json TEXT NOT NULL DEFAULT '{}',
  body_template_json TEXT,
  response_items_path TEXT,
  response_field_map_json TEXT NOT NULL DEFAULT '{}',
  volume_unit TEXT NOT NULL DEFAULT 'unknown' CHECK (volume_unit IN ('base', 'quote', 'unknown')),
  secret_refs_json TEXT NOT NULL DEFAULT '{}',
  poll_interval_seconds INTEGER NOT NULL DEFAULT 300 CHECK (poll_interval_seconds >= 300),
  timeout_ms INTEGER NOT NULL DEFAULT 10000 CHECK (timeout_ms BETWEEN 1000 AND 30000),
  requests_per_minute INTEGER NOT NULL DEFAULT 12 CHECK (requests_per_minute > 0),
  pagination_config_json TEXT NOT NULL DEFAULT '{}',
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  UNIQUE(exchange_id, endpoint_key)
);

CREATE TABLE IF NOT EXISTS timeframes (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  duration_seconds INTEGER NOT NULL UNIQUE CHECK (duration_seconds > 0),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exchange_market_timeframes (
  exchange_market_id INTEGER NOT NULL REFERENCES exchange_markets(id) ON DELETE CASCADE,
  timeframe_id INTEGER NOT NULL REFERENCES timeframes(id),
  endpoint_id INTEGER NOT NULL REFERENCES exchange_api_endpoints(id) ON DELETE CASCADE,
  source_interval_code TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  PRIMARY KEY(exchange_market_id, timeframe_id)
);

-- One row per poll sample; the same 15m/1h source candle may be sampled repeatedly.
CREATE TABLE IF NOT EXISTS market_data_samples (
  id INTEGER PRIMARY KEY,
  exchange_market_id INTEGER NOT NULL REFERENCES exchange_markets(id),
  timeframe_id INTEGER NOT NULL REFERENCES timeframes(id),
  output_market_symbol TEXT NOT NULL,
  native_symbol TEXT NOT NULL,
  source_interval_code TEXT NOT NULL,
  source_open_time_ms INTEGER NOT NULL,
  source_close_time_ms INTEGER,
  source_time_ms INTEGER,
  collected_at_ms INTEGER NOT NULL,
  price TEXT NOT NULL,
  open_price TEXT,
  close_price TEXT,
  volume TEXT,
  value TEXT,
  top_price TEXT,
  low_price TEXT,
  UNIQUE(exchange_market_id, timeframe_id, source_open_time_ms, collected_at_ms)
);
CREATE INDEX IF NOT EXISTS idx_market_data_samples_series
  ON market_data_samples(exchange_market_id, timeframe_id, collected_at_ms);
CREATE INDEX IF NOT EXISTS idx_market_data_samples_bar
  ON market_data_samples(exchange_market_id, timeframe_id, source_open_time_ms, collected_at_ms DESC);

CREATE TABLE IF NOT EXISTS collection_runs (
  id INTEGER PRIMARY KEY,
  exchange_id INTEGER REFERENCES exchanges(id),
  started_at_ms INTEGER NOT NULL,
  finished_at_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed')),
  markets_seen INTEGER NOT NULL DEFAULT 0,
  markets_saved INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_summary TEXT
);

-- Resumable historic backfills. One active job per exchange/market/timeframe.
CREATE TABLE IF NOT EXISTS history_sync_jobs (
  id TEXT PRIMARY KEY,
  exchange_id INTEGER NOT NULL REFERENCES exchanges(id),
  exchange_market_id INTEGER NOT NULL REFERENCES exchange_markets(id),
  timeframe_id INTEGER NOT NULL REFERENCES timeframes(id),
  endpoint_id INTEGER NOT NULL REFERENCES exchange_api_endpoints(id),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','paused','completed','failed','cancelled')),
  from_time_ms INTEGER NOT NULL,
  to_time_ms INTEGER NOT NULL,
  cursor_json TEXT NOT NULL DEFAULT '{}',
  pages_fetched INTEGER NOT NULL DEFAULT 0,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER,
  CHECK (from_time_ms < to_time_ms)
);
CREATE INDEX IF NOT EXISTS idx_history_sync_queue ON history_sync_jobs(status, updated_at_ms);

CREATE TABLE IF NOT EXISTS history_sync_events (
  id INTEGER PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES history_sync_jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_sync_events_job ON history_sync_events(job_id, created_at_ms);
CREATE INDEX IF NOT EXISTS idx_collection_runs_recent ON collection_runs(started_at_ms DESC);

-- Materialized snapshots are recalculated after successful exchange fetches.
-- Scope is one exchange, one exchange type, or all exchanges.
CREATE TABLE IF NOT EXISTS computed_market_samples (
  id INTEGER PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('exchange', 'exchange_type', 'all')),
  scope_key TEXT NOT NULL,
  market_id INTEGER NOT NULL REFERENCES markets(id),
  timeframe_id INTEGER NOT NULL REFERENCES timeframes(id),
  calculated_at_ms INTEGER NOT NULL,
  price TEXT,
  open_price TEXT,
  close_price TEXT,
  high_price TEXT,
  low_price TEXT,
  volume TEXT,
  value TEXT,
  exchange_count INTEGER NOT NULL DEFAULT 0,
  source_oldest_at_ms INTEGER,
  source_newest_at_ms INTEGER,
  UNIQUE(scope_type, scope_key, market_id, timeframe_id, calculated_at_ms)
);
CREATE INDEX IF NOT EXISTS idx_computed_market_latest
  ON computed_market_samples(scope_type, scope_key, market_id, timeframe_id, calculated_at_ms DESC);

-- One implied rate per configured index, exchange, and component asset.
CREATE TABLE IF NOT EXISTS price_index_component_samples (
  id INTEGER PRIMARY KEY,
  index_definition_id INTEGER NOT NULL REFERENCES index_definitions(id),
  exchange_id INTEGER NOT NULL REFERENCES exchanges(id),
  asset_id INTEGER NOT NULL REFERENCES assets(id),
  timeframe_id INTEGER NOT NULL REFERENCES timeframes(id),
  calculated_at_ms INTEGER NOT NULL,
  price TEXT NOT NULL,
  open_price TEXT,
  close_price TEXT,
  high_price TEXT,
  low_price TEXT,
  value TEXT,
  numerator_sample_id INTEGER NOT NULL REFERENCES market_data_samples(id),
  denominator_sample_id INTEGER NOT NULL REFERENCES market_data_samples(id),
  UNIQUE(index_definition_id, exchange_id, asset_id, timeframe_id, calculated_at_ms)
);
CREATE INDEX IF NOT EXISTS idx_price_index_component_latest
  ON price_index_component_samples(index_definition_id, exchange_id, timeframe_id, calculated_at_ms DESC);

-- Per-exchange indices, then CEX/OTC/all indices built from the per-exchange rows.
CREATE TABLE IF NOT EXISTS price_index_samples (
  id INTEGER PRIMARY KEY,
  index_definition_id INTEGER NOT NULL REFERENCES index_definitions(id),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('exchange', 'exchange_type', 'all')),
  scope_key TEXT NOT NULL,
  timeframe_id INTEGER NOT NULL REFERENCES timeframes(id),
  calculated_at_ms INTEGER NOT NULL,
  price TEXT,
  open_price TEXT,
  close_price TEXT,
  high_price TEXT,
  low_price TEXT,
  value TEXT,
  exchange_count INTEGER NOT NULL DEFAULT 0,
  asset_count INTEGER NOT NULL DEFAULT 0,
  source_oldest_at_ms INTEGER,
  source_newest_at_ms INTEGER,
    UNIQUE(index_definition_id, scope_type, scope_key, timeframe_id, calculated_at_ms)
);
CREATE INDEX IF NOT EXISTS idx_price_index_latest
  ON price_index_samples(index_definition_id, scope_type, scope_key, timeframe_id, calculated_at_ms DESC);

-- Passwords use a salted PBKDF2 hash. API tokens are random secrets; store only
-- their SHA-256 hash, scopes, expiry, and revocation state.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 310000,
  role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('reader', 'admin')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scopes_json TEXT NOT NULL DEFAULT '["read"]',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  expires_at_ms INTEGER,
  last_used_at_ms INTEGER,
  created_at_ms INTEGER NOT NULL,
  revoked_at_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id, enabled);

CREATE TABLE IF NOT EXISTS api_access_policies (
  route_key TEXT PRIMARY KEY,
  is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  updated_at_ms INTEGER NOT NULL,
  updated_by INTEGER REFERENCES users(id)
);

INSERT OR IGNORE INTO api_access_policies (route_key, is_public, enabled, updated_at_ms) VALUES
 ('exchanges.list',1,1,unixepoch()*1000), ('assets.list',1,1,unixepoch()*1000),
 ('markets.list',1,1,unixepoch()*1000), ('exchange-markets.list',1,1,unixepoch()*1000),
 ('timeframes.list',1,1,unixepoch()*1000), ('quotes.latest',1,1,unixepoch()*1000),
 ('quotes.series',1,1,unixepoch()*1000), ('aggregates.latest',1,1,unixepoch()*1000),
 ('aggregates.series',1,1,unixepoch()*1000), ('indices.list',1,1,unixepoch()*1000),
 ('indices.latest',1,1,unixepoch()*1000), ('indices.components',1,1,unixepoch()*1000),
 ('indices.exchanges',1,1,unixepoch()*1000), ('indices.series',1,1,unixepoch()*1000),
 ('charting.config',1,1,unixepoch()*1000), ('charting.search',1,1,unixepoch()*1000),
 ('charting.symbols',1,1,unixepoch()*1000), ('charting.history',1,1,unixepoch()*1000);

-- Canonical starting assets and markets. Exchange rows/native symbols are configured later.
INSERT OR IGNORE INTO assets (code, name, asset_type, name_fa, name_en, enabled, display_order, created_at_ms, updated_at_ms) VALUES
  ('BTC', 'Bitcoin', 'crypto', 'بیت‌کوین', 'Bitcoin', 1, 10, unixepoch() * 1000, unixepoch() * 1000),
  ('ETH', 'Ethereum', 'crypto', 'اتریوم', 'Ethereum', 1, 20, unixepoch() * 1000, unixepoch() * 1000),
  ('BNB', 'BNB', 'crypto', 'بایننس کوین', 'BNB', 1, 30, unixepoch() * 1000, unixepoch() * 1000),
  ('TRX', 'TRON', 'crypto', 'ترون', 'TRON', 1, 40, unixepoch() * 1000, unixepoch() * 1000),
  ('USDT', 'Tether', 'stablecoin', 'تتر', 'Tether', 1, 50, unixepoch() * 1000, unixepoch() * 1000),
  ('USDC', 'USD Coin', 'stablecoin', 'یو‌اس‌دی کوین', 'USD Coin', 1, 60, unixepoch() * 1000, unixepoch() * 1000),
  ('TMN', 'Toman', 'fiat', 'تومان', 'Toman', 1, 90, unixepoch() * 1000, unixepoch() * 1000);

-- The four initial venues selected by the owner. No unverified native symbols
-- or endpoint mappings are seeded here; those are added after adapter research.
INSERT OR IGNORE INTO exchanges
  (code, name, name_fa, name_en, exchange_type, enabled, display_order, adapter_key,
   public_api_base_url, description_fa, description_en, website_url, documentation_url,
   country_code, created_at_ms, updated_at_ms)
VALUES
  ('nobitex', 'Nobitex', 'نوبیتکس', 'Nobitex', 'cex', 1, 10, 'nobitex',
   'https://apiv2.nobitex.ir', 'صرافی متمرکز رمزارز', 'Centralized cryptocurrency exchange',
   'https://nobitex.ir', 'https://apidocs.nobitex.ir/', 'IR', unixepoch()*1000, unixepoch()*1000),
  ('wallex', 'Wallex', 'والکس', 'Wallex', 'cex', 1, 20, 'wallex',
   'https://api.wallex.ir', 'صرافی متمرکز رمزارز', 'Centralized cryptocurrency exchange',
   'https://wallex.ir', 'https://developers.wallex.ir/', 'IR', unixepoch()*1000, unixepoch()*1000),
  ('bitpin', 'Bitpin', 'بیت‌پین', 'Bitpin', 'cex', 1, 30, 'bitpin',
   'https://api.bitpin.org', 'صرافی متمرکز رمزارز', 'Centralized cryptocurrency exchange',
   'https://bitpin.ir', 'https://docs.bitpin.ir/', 'IR', unixepoch()*1000, unixepoch()*1000),
  ('visapay', 'VisaPay', 'ویزاپی', 'VisaPay', 'otc', 1, 40, 'visapay',
   NULL, 'خدمات OTC؛ API عمومی بازار هنوز تأیید نشده است',
   'OTC service; a public market API has not yet been verified',
   'https://visapay.me', NULL, 'IR', unixepoch()*1000, unixepoch()*1000);

INSERT OR IGNORE INTO timeframes (code, duration_seconds, display_order) VALUES
  ('5m', 300, 10), ('15m', 900, 20), ('1h', 3600, 30),
  ('4h', 14400, 40), ('1d', 86400, 50);

WITH pairs(code, base_code, quote_code, position, precision) AS (VALUES
  ('BTCTMN', 'BTC', 'TMN', 10, 0), ('BTCUSDT', 'BTC', 'USDT', 20, 2),
  ('ETHUSDT', 'ETH', 'USDT', 30, 4), ('ETHTMN', 'ETH', 'TMN', 40, 0),
  ('BNBTMN', 'BNB', 'TMN', 50, 0), ('BNBUSDT', 'BNB', 'USDT', 60, 3),
  ('TRXUSDT', 'TRX', 'USDT', 70, 6), ('TRXTMN', 'TRX', 'TMN', 80, 0),
  ('USDTTMN', 'USDT', 'TMN', 90, 0), ('USDCTMN', 'USDC', 'TMN', 100, 0)
)
INSERT OR IGNORE INTO markets (code, base_asset_id, quote_asset_id, display_name_fa, display_name_en, enabled, display_order, price_precision, created_at_ms, updated_at_ms)
SELECT pair.code, base.id, quote.id, base.name_fa || ' / ' || quote.name_fa,
       base.name_en || ' / ' || quote.name_en, 1, pair.position, pair.precision,
       unixepoch() * 1000, unixepoch() * 1000
FROM pairs pair
JOIN assets base ON base.code=pair.base_code
JOIN assets quote ON quote.code=pair.quote_code;

INSERT OR IGNORE INTO index_definitions
  (code, base_asset_id, quote_asset_id, direct_market_id, method_key,
   name_fa, name_en, enabled, display_order, created_at_ms, updated_at_ms)
SELECT direct.code, base.id, quote.id, direct.id, 'cross_rate_mean',
       base.name_fa || ' / ' || quote.name_fa || ' (شاخص)',
       base.name_en || ' / ' || quote.name_en || ' index',
       1, 10, unixepoch()*1000, unixepoch()*1000
FROM markets direct
JOIN assets base ON base.code='USDT'
JOIN assets quote ON quote.code='TMN'
WHERE direct.base_asset_id=base.id AND direct.quote_asset_id=quote.id;

INSERT OR IGNORE INTO index_definition_components
  (index_definition_id, asset_id, numerator_market_id, denominator_market_id, enabled, display_order)
SELECT definition.id, component.id, numerator.id, denominator.id, 1, component.display_order
FROM index_definitions definition
JOIN assets index_base ON index_base.id=definition.base_asset_id
JOIN assets index_quote ON index_quote.id=definition.quote_asset_id
JOIN markets numerator ON numerator.quote_asset_id=index_quote.id
JOIN assets component ON component.id=numerator.base_asset_id
JOIN markets denominator ON denominator.base_asset_id=component.id
  AND denominator.quote_asset_id=index_base.id
WHERE definition.code='USDTTMN' AND component.code IN ('BTC', 'ETH', 'BNB', 'TRX');
