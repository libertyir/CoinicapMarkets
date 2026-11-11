# Exchange API configuration

Exchange HTTP details are records in `exchange_api_endpoints`, so endpoint paths, request templates, response locations, and field names can be adjusted without changing API/application code for ordinary REST JSON venues.

## Endpoint configuration

Each row describes one operation (for example `candles`):

- HTTP method and a path template relative to the exchange's validated HTTPS base URL.
- Header, query, and optional body JSON templates; placeholders are limited to documented values such as `{native_symbol}` and `{source_interval}`.
- `response_items_path` locates the response item/list; `response_field_map_json` maps source JSON paths to canonical fields: `price`, `open`, `close`, `volume`, `top_price`, `low_price`, `source_open_time_ms`, `source_close_time_ms`, and `source_time_ms`.
- `exchange_market_timeframes` maps the public timeframe (`15m`) to the venue's own interval code (`15`, `15min`, etc.) and selected endpoint.
- Per-endpoint `poll_interval_seconds`, `timeout_ms`, and request-rate limit.

The mapping has three names that must not be conflated: product output symbol (`markets.code`), exchange pair symbol (`exchange_markets.native_symbol`), and output timeframe vs venue-native source interval.

## Safety and secrets

Configuration is declarative. Do not evaluate user-supplied JavaScript, Python, or expressions. Validate JSON paths and templates; only allow HTTPS endpoints under an approved exchange API host; reject localhost/private-network targets and redirects to other hosts. API keys/passwords never go into D1 or GitHub. `secret_refs_json` stores only Cloudflare secret names, resolved at request time. Contact details are stored in `exchange_contacts`; only fields marked public may appear in the public exchange directory.

Some venues may need a small custom adapter if their protocol is not ordinary REST/JSON. Keep one adapter per venue under `server/src/exchanges/`, and keep it below 500 lines by splitting mapping, parsing, and transport helpers.
