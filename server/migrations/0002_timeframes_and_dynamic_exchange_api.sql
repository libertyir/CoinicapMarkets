-- Exchange profile and contact metadata; keep public identity separate from API config.
ALTER TABLE exchanges ADD COLUMN description TEXT;
ALTER TABLE exchanges ADD COLUMN website_url TEXT;
ALTER TABLE exchanges ADD COLUMN documentation_url TEXT;
ALTER TABLE exchanges ADD COLUMN support_url TEXT;
ALTER TABLE exchanges ADD COLUMN support_email TEXT;
ALTER TABLE exchanges ADD COLUMN status_page_url TEXT;
ALTER TABLE exchanges ADD COLUMN logo_url TEXT;
ALTER TABLE exchanges ADD COLUMN country_code TEXT;

ALTER TABLE exchange_markets RENAME COLUMN symbol TO native_symbol;

CREATE TABLE exchange_contacts (
  id INTEGER PRIMARY KEY,
  exchange_id INTEGER NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL,
  label TEXT,
  value TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_exchange_contacts_exchange ON exchange_contacts(exchange_id, display_order);

-- Declarative REST configuration. Never put secret values here; secret_refs_json
-- refers to Cloudflare Worker secrets. url_template is a path under the validated
-- exchange base URL, not an arbitrary script or executable expression.
CREATE TABLE exchange_api_endpoints (
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

CREATE TABLE timeframes (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  duration_seconds INTEGER NOT NULL UNIQUE CHECK (duration_seconds > 0),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0
);
INSERT INTO timeframes (code, duration_seconds, display_order) VALUES
  ('5m', 300, 10), ('15m', 900, 20), ('1h', 3600, 30), ('4h', 14400, 40), ('1d', 86400, 50);

-- Collection cadence (endpoint poll interval) is independent of the exchange bar
-- timeframe. The same open candle can therefore be sampled repeatedly every 5 min.
CREATE TABLE exchange_market_timeframes (
  exchange_market_id INTEGER NOT NULL REFERENCES exchange_markets(id) ON DELETE CASCADE,
  timeframe_id INTEGER NOT NULL REFERENCES timeframes(id),
  endpoint_id INTEGER NOT NULL REFERENCES exchange_api_endpoints(id) ON DELETE CASCADE,
  source_interval_code TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  PRIMARY KEY(exchange_market_id, timeframe_id)
);

CREATE TABLE market_data_samples (
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
CREATE INDEX idx_market_data_samples_series
  ON market_data_samples(exchange_market_id, timeframe_id, collected_at_ms);
CREATE INDEX idx_market_data_samples_bar
  ON market_data_samples(exchange_market_id, timeframe_id, source_open_time_ms, collected_at_ms DESC);
