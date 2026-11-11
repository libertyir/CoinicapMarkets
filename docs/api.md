# Public API (initial contract)

All routes are read-only `GET`, versioned under `/api/v1`, and cached for five minutes. API responses include decimal prices as strings and observation timestamps. CORS policy and API key/rate-limit rules should be set before opening a paid or high-volume service to the public internet.

| Route | Behavior |
|---|---|
| `/api/v1/exchanges` | Enabled exchanges in display order. |
| `/api/v1/markets` | Enabled canonical markets and asset codes. |
| `/api/v1/quotes/latest?exchange=...&market=...` | Latest good quote(s); either filter is optional. Includes collection age. |
| `/api/v1/quotes/series?exchange=...&market=...&from=MS&to=MS` | Historical observations for one venue/pair; maximum 90 days and 20,000 returned rows. |
| `/api/v1/estimates/usdt-tmn` | Contract reserved for direct and estimated USDT/TMN comparison. Currently reports `not_configured`. |
| `/health` | Liveness only; does not query an exchange. |

The USDT/TMN estimate is planned to derive candidate rates from same-exchange cross pairs (for example `BTCTMN / BTCUSDT`) and aggregate only fresh, valid inputs. The response should expose the direct rate, estimate, percentage gap, input venues, method/version, sample time, and confidence/quality flags. This endpoint is not implemented as a financial recommendation.
