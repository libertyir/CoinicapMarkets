const SCALE_DIGITS = 12;
const SCALE = 10n ** BigInt(SCALE_DIGITS);

function scaled(value) {
  if (value === null || value === undefined || value === "") return null;
  const match = String(value).trim().match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) throw new Error("invalid_decimal");
  const [, sign, whole, fraction = ""] = match;
  const digits = fraction.padEnd(SCALE_DIGITS + 1, "0");
  let result = BigInt(whole) * SCALE + BigInt(digits.slice(0, SCALE_DIGITS));
  if (digits[SCALE_DIGITS] >= "5") result += 1n;
  return sign ? -result : result;
}

function decimal(value) {
  if (value === null) return null;
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const whole = absolute / SCALE;
  const fraction = (absolute % SCALE).toString().padStart(SCALE_DIGITS, "0").replace(/0+$/, "");
  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}

export function average(values) {
  const items = values.map(scaled).filter((value) => value !== null);
  if (!items.length) return null;
  return decimal(items.reduce((total, value) => total + value, 0n) / BigInt(items.length));
}

export function total(values) {
  const items = values.map(scaled).filter((value) => value !== null);
  return items.length ? decimal(items.reduce((sum, value) => sum + value, 0n)) : null;
}

export function extreme(values, direction) {
  const items = values.map(scaled).filter((value) => value !== null);
  if (!items.length) return null;
  const result = items.reduce((picked, value) => direction === "max"
    ? (value > picked ? value : picked)
    : (value < picked ? value : picked));
  return decimal(result);
}

export function ratio(numerator, denominator) {
  const top = scaled(numerator);
  const bottom = scaled(denominator);
  if (top === null || bottom === null || bottom === 0n) return null;
  return decimal((top * SCALE) / bottom);
}

export function product(left, right) {
  const first = scaled(left);
  const second = scaled(right);
  if (first === null || second === null) return null;
  return decimal((first * second) / SCALE);
}

export function percentageGap(estimated, direct) {
  const estimateValue = scaled(estimated);
  const directValue = scaled(direct);
  if (estimateValue === null || directValue === null || directValue === 0n) return null;
  return decimal(((estimateValue - directValue) * 100n * SCALE) / directValue);
}
