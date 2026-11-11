# Database design

The complete fresh-database schema is in `server/db/bootstrap.sql`. Before pilot, maintain that sin…3537 tokens truncated…        schema: { type: string }
        - in: query
          name: from
          required: true
          description: Inclusive Unix timestamp in milliseconds
          schema: { type: integer }
        - in: query
          name: to
          required: true
          description: Inclusive Unix timestamp in milliseconds; maximum range is 90 days
          schema: { type: integer }
      responses:
        '200':
          description: Historical observations
        '400':
          description: Invalid parameters
  /api/v1/aggregates/latest:
    get:
      summary: Get latest cross-exchange aggregates
      parameters:
        - in: query
          name: market
          schema: { type: string }
        - in: query
          name: timeframe
          schema: { type: string }
        - in: query
          name: type
          description: Filter to cex or otc; omit to return all scopes
          schema: { type: string, enum: [cex, otc] }
      responses:
        '200':
          description: Means, cross-exchange high/low, volume/value sums, and contributor counts
  /api/v1/estimates/usdt-tmn:
    get:
      summary: Direct and implied USDT/TMN index
      parameters:
        - in: query
          name: timeframe
          schema: { type: string, default: 5m }
        - in: query
          name: type
          schema: { type: string, enum: [cex, otc] }
        - in: query
          name: exchange
          description: Return one exchange's implied index
          schema: { type: string }
      responses:
        '200':
          description: Derived index, direct USDTTMN aggregate, contributing assets and freshness
  /api/v1/estimates/usdt-tmn/components:
    get:
      summary: Get per-exchange and per-asset implied USDT/TMN rates
      parameters:
        - in: query
          name: timeframe
          schema: { type: string, default: 5m }
        - in: query
          name: type
          schema: { type: string, enum: [cex, otc] }
        - in: query
          name: exchange
          schema: { type: string }
      responses:
        '200':
          description: Implied rates and both source sample timestamps
  /api/v1/estimates/usdt-tmn/exchanges:
    get:
      summary: Get the latest implied index for each exchange
      parameters:
        - in: query
          name: timeframe
          schema: { type: string, default: 5m }
      responses:
        '200':
          description: Per-exchange indices with CEX/OTC classification
