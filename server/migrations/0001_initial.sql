PRAGMA foreign_keys = ON;

CREATE TABLE exchanges (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0,
  adapter_key TEXT NOT NULL,
  public_api_base_url TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE assets (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE markets (
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

-- A canonical market can be enabled independently at each exchange. `symbol` is the
-- exchange's native symbol; adapter_config_json allows future per-market API options.
CREATE TABLE exchange_markets (
  id INTEGER PRIMARY KEY,
  exchange_id INTEGER NOT NULL REFERENCES exchanges(id),
  market_id INTEGER NOT NULL REFERENCES markets(id),
  symbol TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0,
  adapter_config_json TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  UNIQUE(exchange_id, market_id),
  UNIQUE(exchange_id, symbol)
);

CREATE TABLE observations (
  id INTEGER PRIMARY KEY,
  exchange_market_id INTEGER NOT NULL REFERENCES exchange_markets(id),
  price TEXT NOT NULL,
  source_time_ms INTEGER,
  collected_at_ms INTEGER NOT NULL,
  UNIQUE(exchange_market_id, collected_at_ms)
);
CREATE INDEX idx_observations_series ON observations(exchange_market_id, collected_at_ms);

-- Hot path for API reads; updated atomically only after a valid new ticker arrives.
CREATE TABLE latest_quotes (
  exchange_market_id INTEGER PRIMARY KEY REFERENCES exchange_markets(id),
  price TEXT NOT NULL,
  source_time_ms INTEGER,
  collected_at_ms INTEGER NOT NULL
);
CREATE INDEX idx_latest_quotes_age ON latest_quotes(collected_at_ms);

CREATE TABLE collection_runs (
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
CREATE INDEX idx_collection_runs_recent ON collection_runs(started_at_ms DESC);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at_ms INTEGER NOT NULL
);

-- Canonical starting universe; deployments can add, disable, or reorder records later.
INSERT OR IGNORE INTO assets (code, name, enabled, display_order, created_at_ms, updated_at_ms) VALUES
  ('BTC', 'Bitcoin', 1, 10, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('ETH', 'Ethereum', 1, 20, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('BNB', 'BNB', 1, 30, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('TRX', 'TRON', 1, 40, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('USDT', 'Tether', 1, 50, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('USDC', 'USD Coin', 1, 60, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('TMN', 'Toman', 1, 90, CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000);

WITH pairs(code, base_code, quote_code, position, precision) AS (VALUES
  ('BTCTMN', 'BTC', 'TMN', 10, 0), ('BTCUSDT', 'BTC', 'USDT', 20, 2),
  ('ETHUSDT', 'ETH', 'USDT', 30, 4), ('ETHTMN', 'ETH', 'TMN', 40, 0),
  ('BNBTMN', 'BNB', 'TMN', 50, 0), ('BNBUSDT', 'BNB', 'USDT', 60, 3),
  ('TRXUSDT', 'TRX', 'USDT', 70, 6), ('TRXTMN', 'TRX', 'TMN', 80, 0),
  ('USDTTMN', 'USDT', 'TMN', 90, 0), ('USDCTMN', 'USDC', 'TMN', 100, 0)
)
INSERT OR IGNORE INTO markets (code, base_asset_id, quote_asset_id, enabled, display_order, price_precision, created_at_ms, updated_at_ms)
SELECT pair.code, base.id, quote.id, 1, pair.position, pair.precision,
       CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000
FROM pairs pair
JOIN assets base ON base.code=pair.base_code
JOIN assets quote ON quote.code=pair.quote_code;
