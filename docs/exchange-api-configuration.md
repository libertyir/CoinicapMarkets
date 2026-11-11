# Exchange API configuration

Exchange HTTP details are records in `exchange_api_endpoints`, so endpoint paths, request templates, response locations, and field names can be adjusted without changing API/application code for ordinary REST JSON venues.

## Endpoint configuration

Each row describes one operation (for example `candles`):

- HTTP method and a path template relative to the exchange's validated HTTPS base URL.
- Header, query, and optional body JSON templates; placeholders are limited to documented values such as `{native_symbol}` and `{source_interval}`.
- `response_items_path` locates the response item/list; `response_field_map_json` maps source JSON paths to canonical fields: `price`, `open`, `close`, `volume`, `value`, `top_price`, `low_price`, `source_open_time_ms`, `source_close_time_ms`, and `source_time_ms`.
- `volume_unit` states whether returned volume is in base currency, quote currency, or unknown. Persist `value` as quote-currency turnover; if the source has no value field, compute `price × volume` only when `volume_unit=base`.
- `exchange_market_timeframes` maps the public timeframe (`15m`) to the venue's own interval code (`15`, `15min`, etc.) and selected endpoint.
- Per-endpoint `poll_interval_seconds`, `timeout_ms`, and request-rate limit.

The mapping has three names that must not be conflated: product output symbol (`markets.code`), exchange pair symbol (`exchange_markets.native_symbol`), and output timeframe vs venue-native source interval.

## Safety and secrets

Configuration is declarative. Do not evaluate user-supplied JavaScript, Python, or expressions. Validate JSON paths and templates; only allow HTTPS endpoints under an approved exchange API host; reject localhost/private-network targets and redirects to other hosts. API keys/passwords never go into D1 or GitHub. `secret_refs_json` stores only Cloudflare secret names, resolved at request time. Contact details are stored in `exchange_contacts`; only fields marked public may appear in the public exchange directory.

Some venues may need a small custom adapter if their protocol is not ordinary REST/JSON. Keep one adapter per venue under `server/src/exchanges/`, and keep it below 500 lines by splitting mapping, parsing, and transport helpers.

## Initial venue research (11 November 2026)

| Venue | Product type in directory | Public market data found | Notes |
|---|---|---|---|
| Nobitex | CEX | Yes: public `GET /market/stats` and `/market/udf/history`. The latter returns timestamps and OHLCV arrays and supports normalized resolutions including 5, 15, and 60 minutes. | Official docs show 20 stats requests/minute and a maximum of 500 candles per history page. Map `dayHigh/dayLow` or candle `h/l` to TopPrice/LowPrice. |
| Wallex | CEX | Yes: public spot market directory at `GET /hector/web/v1/markets`; official docs describe public market data and separately protect personal/trading endpoints with API keys. | Directory returns spot/OTC availability flags per pair. Confirm an official OHLCV endpoint and symbols/intervals before activating collection. |
| Bitpin | CEX | Yes: official public endpoints include `/api/v1/mkt/markets/`, `/api/v1/mkt/tickers/`, and `/api/v1/mkt/candles/`. | The SDK API spec marks these as public/no token and gives default rate limits; candle endpoint is documented for up to 10,000 items per request. Validate candle response semantics before mapping. |
| VisaPay (visapay.me) | OTC, as selected by the owner | Public website displays instantaneous quote/market information, but no public developer API documentation was located. | Treat the quote as a separate OTC quote source, not an exchange order-book/candle feed. Do not scrape. Enable only after VisaPay confirms an integration API and its terms, authentication, quote expiry, and supported pairs. |

Official references: [Nobitex market stats and OHLC](https://github.com/nobitex/docs-api/blob/master/source/includes/_market_data.md), [Wallex spot markets](https://developers.wallex.ir/spot/activemarket) and [API introduction](https://developers.wallex.ir/intro), [Bitpin official API specification](https://github.com/bitpin-dev/bitpin-sdk/blob/main/spec/bitpin.yaml), [VisaPay website](https://visapay.me/).

The initial bootstrap inserts the four exchange directory records with bilingual names/descriptions and type. It intentionally does not seed unverified native symbols or activate endpoints. Public-read/private-write access is distinct for the source exchanges and for CoinicapMarkets itself: source API keys are not required for the documented public CEX market reads; CoinicapMarkets configuration changes must use our own authenticated, scoped admin API once implemented. Never expose those admin tokens to the browser.
