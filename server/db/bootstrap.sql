-- CoinicapMarkets fresh-database bootstrap.
-- Apply only to a new/empty D1 database after the owner approves pilot setup.
-- Do not use this file to update an existing database; pre-pilot schema changes
-- are made here, while post-pilot data changes require an explicit migration plan.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS exchanges (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0,
  adapter_key TEXT NOT NULL DEFAULT 'generic_rest',
  public_api_base_url TEXT,
  description TEXT,
  website_url TEXT,
  documentation_url TEXT,
  support_url TEXT,
  support_email TEXT,
  status_page_url TEXT,
  logo_url TEXT,
  country_code TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS exchange_contacts (
  id INTEGER PRIMARY KEY,
  exchange_id INTEGER NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL,
  label TEXT,
  value TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_exchange_contacts_exchange
  ON exchange_contacts(exchange_id, display_order);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

-- `code` is our canonical/public output symbol (e.g. BTCTMN).
CREATE TABLE IF NOT EXISTS markets (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  base_asset_id INTEGER NOT NULL REFERENCES assets(id),
  quote_asset_id INTEGER NOT NULL REFERENCES assets(id),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0,
  price_precision INTEGER NOT NULL DEFAULT 8,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  UNIQUE(base_asset_id, quote_asset_id),
  CHECK (base_asset_id <> quote_asset_id)
);

-- `native_symbol` is the exact symbol used by this exchange, not our output symbol.
CREATE TABLE IF NOT EXISTS exchange_markets (
  id INTEGER PRIMARY KEY,
  exchange_id INTEGER NOT NULL REFERENCES exchanges(id),
  market_id INTEGER NOT NULL REFERENCES markets(id),
  native_symbol TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0,
  adapter_config_json TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  UNIQUE(exchange_id, market_id),
  UNIQUE(exchange_id, native_symbol)
);

-- Declarative API settings; secret values belong in Cloudflare secrets, never in D1.
CREATE TABLE IF NOT EXISTS exchange_api_endpoints (
  id INTEGER PRIMARY KEY,
  exchange_id INTEGER NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  endpoint_key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  http_method TEXT NOT NULL DEFAULT 'GET' CHECK (http_method IN ('GET', 'POST')),
  url_template TEXT NOT NULL,
  headers_json TEXT NOT NULL DEFAULT '{}',
  query_template_json TEXT NOT NULL DEFAULT '{}',
  body_template_json TEXT,
  response_items_path TEXT,
  response_field_map_json TEXT NOT NULL DEFAULT '{}',
  secret_refs_json TEXT NOT NULL DEFAULT '{}',
  poll_interval_seconds INTEGER NOT NULL DEFAULT 300 CHECK (poll_interval_seconds >= 300),
  timeout_ms INTEGER NOT NULL DEFAULT 10000 CHECK (timeout_ms BETWEEN 1000 AND 30000),
  requests_per_minute INTEGER NOT NULL DEFAULT 12 CHECK (requests_per_minute > 0),
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
CREATE INDEX IF NOT EXISTS idx_collection_runs_recent ON collection_runs(started_at_ms DESC);

-- Canonical starting assets and markets. Exchange rows/native symbols are configured later.
INSERT OR IGNORE INTO assets (code, name, enabled, display_order, created_at_ms, updated_at_ms) VALUES
  ('BTC', 'Bitcoin', 1, 10, unixepoch() * 1000, unixepoch() * 1000),
  ('ETH', 'Ethereum', 1, 20, unixepoch() * 1000, unixepoch() * 1000),
  ('BNB', 'BNB', 1, 30, unixepoch() * 1000, unixepoch() * 1000),
  ('TRX', 'TRON', 1, 40, unixepoch() * 1000, unixepoch() * 1000),
  ('USDT', 'Tether', 1, 50, unixepoch() * 1000, unixepoch() * 1000),
  ('USDC', 'USD Coin', 1, 60, unixepoch() * 1000, unixepoch() * 1000),
  ('TMN', 'Toman', 1, 90, unixepoch() * 1000, unixepoch() * 1000);

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
INSERT OR IGNORE INTO markets (code, base_asset_id, quote_asset_id, enabled, display_order, price_precision, created_at_ms, updated_at_ms)
SELECT pair.code, base.id, quote.id, 1, pair.position, pair.precision,
       unixepoch() * 1000, unixepoch() * 1000
FROM pairs pair
JOIN assets base ON base.code=pair.base_code
JOIN assets quote ON quote.code=pair.quote_code;
