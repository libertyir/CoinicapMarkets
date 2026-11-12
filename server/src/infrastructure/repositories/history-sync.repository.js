import { HistoryCandle } from "../../domain/entities/history-candle.js";
import { ApplicationError } from "../../domain/errors/application-error.js";

export class HistorySyncRepository {
  constructor(db) { this.db=db; }
  async importJson({exchange,market,timeframe,candles}) {
    const mapping=await this.db.prepare(`SELECT em.id AS exchange_market_id,em.native_symbol,
      tf.id AS timeframe_id,ep.id AS endpoint_id,ep.endpoint_key,ep.volume_unit
      FROM exchange_markets em JOIN exchanges e ON e.id=em.exchange_id
      JOIN markets m ON m.id=em.market_id JOIN exchange_market_timeframes emt ON emt.exchange_market_id=em.id
      JOIN timeframes tf ON tf.id=emt.timeframe_id JOIN exchange_api_endpoints ep ON ep.id=emt.endpoint_id
      WHERE e.code=? AND m.code=? AND tf.code=? AND e.enabled=1 AND m.enabled=1
      AND em.enabled=1 AND emt.enabled=1 AND ep.enabled=1`).bind(exchange,market,timeframe).first();
    if (!mapping) throw new ApplicationError("history_mapping_not_found",404);
    const prepared=candles.map((raw)=>{
      const candle=new HistoryCandle(raw);
      return this.db.prepare(`INSERT OR IGNORE INTO market_data_samples
        (exchange_market_id,timeframe_id,output_market_symbol,native_symbol,source_interval_code,
         source_open_time_ms,source_close_time_ms,source_time_ms,collected_at_ms,price,open_price,
         close_price,volume,value,top_price,low_price)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(mapping.exchange_market_id,mapping.timeframe_id,
        market,mapping.native_symbol,candle.source_interval_code,candle.time_ms,
        raw.close_time_ms??null,raw.source_time_ms??candle.time_ms,candle.time_ms,
        candle.close,candle.open,candle.close,candle.volume,candle.value,candle.high,candle.low);
    });
    let inserted=0;
    for(let i=0;i<prepared.length;i+=100){
      const results=await this.db.batch(prepared.slice(i,i+100));
      inserted+=results.reduce((n,r)=>n+(r.meta?.changes||0),0);
    }
    return {received:candles.length,inserted,duplicates:candles.length-inserted};
  }
}
