import { ApplicationError } from "../errors/application-error.js";

const DECIMAL=/^\d{1,30}(\.\d{1,18})?$/;
function compare(a,b) {
  const [aw,af=""] = a.split("."), [bw,bf=""] = b.split(".");
  const left=aw.replace(/^0+(?=\d)/, ""), right=bw.replace(/^0+(?=\d)/, "");
  if(left.length!==right.length) return left.length>right.length?1:-1;
  if(left!==right) return left>right?1:-1;
  const width=Math.max(af.length,bf.length), x=af.padEnd(width,"0"), y=bf.padEnd(width,"0");
  return x===y?0:x>y?1:-1;
}
export class HistoryCandle {
  constructor(row) {
    const time=Number(row.time_ms);
    const values=[row.open,row.high,row.low,row.close];
    if (!Number.isSafeInteger(time)||time<=0||values.some(v=>typeof v!=="string"||!DECIMAL.test(v)))
      throw new ApplicationError("invalid_candle",400,"Candle time and OHLC decimal strings are required");
    if (compare(row.high,row.open)<0 || compare(row.high,row.close)<0 ||
        compare(row.low,row.open)>0 || compare(row.low,row.close)>0)
      throw new ApplicationError("invalid_candle_range",400,"High/low must contain open and close");
    this.time_ms=time; this.open=row.open; this.high=row.high; this.low=row.low; this.close=row.close;
    this.volume=row.volume??null; this.value=row.value??null; this.source_interval_code=row.source_interval_code||"json";
  }
}
