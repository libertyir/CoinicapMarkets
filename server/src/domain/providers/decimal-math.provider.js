const DIGITS = 12;
const SCALE = 10n ** BigInt(DIGITS);

function toScaled(value) {
  if (value === null || value === undefined || value === "") return null;
  const match = String(value).trim().match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) throw new Error("invalid_decimal");
  const [, sign, whole, fraction = ""] = match;
  const digits = fraction.padEnd(DIGITS + 1, "0");
  let result = BigInt(whole) * SCALE + BigInt(digits.slice(0, DIGITS));
  if (digits[DIGITS] >= "5") result += 1n;
  return sign ? -result : result;
}

function fromScaled(value) {
  if (value === null) return null;
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const whole = absolute / SCALE;
  const fraction = (absolute % SCALE).toString().padStart(DIGITS, "0").replace(/0+$/, "");
  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}

export function average(values) {
  const items = values.map(toScaled).filter((value) => value !== null);
  return items.length ? fromScaled(items.reduce((sum, value) => sum + value, 0n) / BigInt(items.length)) : null;
}

export function sum(values) {
  const items = values.map(toScaled).filter((value) => value !== null);
  return items.length ? fromScaled(items.reduce((total, value) => total + value, 0n)) : null;
}

export function extreme(values, direction) {
  const items = values.map(toScaled).filter((value) => value !== null);
  if (!items.length) return null;
  const result = items.reduce((picked, value) => direction === "max"
    ? (value > picked ? value : picked) : (value < picked ? value : picked));
  return fromScaled(result);
}

export function divide(numerator, denominator) {
  const top = toScaled(numerator);
  const bottom = toScaled(denominator);
  return top === null || bottom === null || bottom === 0n
    ? null : fromScaled((top * SCALE) / bottom);
}

export function percentageDifference(value, reference) {
  const current = toScaled(value);
  const base = toScaled(reference);
  return current === null || base === null || base === 0n
    ? null : fromScaled(((current - base) * 100n * SCALE) / base);
}
