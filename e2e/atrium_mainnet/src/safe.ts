const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_INTEGER_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);
const INTEGER_PATTERN = /^-?\d+$/;

export type IntegerLike = string | number | bigint;

const addThousandsSeparators = (value: string) =>
  value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function parseIntegerLike(value: IntegerLike, label: string): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new Error(`${label} must be an integer.`);
    }

    return BigInt(value);
  }

  const normalized = value.trim();
  if (!INTEGER_PATTERN.test(normalized)) {
    throw new Error(`${label} must be an integer.`);
  }

  return BigInt(normalized);
}

export function toSafeIntegerNumber(value: IntegerLike, label: string): number {
  const normalized = parseIntegerLike(value, label);

  if (
    normalized > MAX_SAFE_INTEGER_BIGINT ||
    normalized < MIN_SAFE_INTEGER_BIGINT
  ) {
    throw new Error(`${label} is outside the browser safe integer range.`);
  }

  return Number(normalized);
}

export function formatTimestampMs(
  value: IntegerLike | null | undefined,
  fallbackLabel = "unknown time",
): string {
  if (value === undefined || value === null) {
    return fallbackLabel;
  }

  let normalized: bigint;
  try {
    normalized = parseIntegerLike(value, "timestamp");
  } catch {
    return fallbackLabel;
  }

  if (
    normalized > MAX_SAFE_INTEGER_BIGINT ||
    normalized < MIN_SAFE_INTEGER_BIGINT
  ) {
    return `${normalized.toString()} ms`;
  }

  const date = new Date(Number(normalized));
  return Number.isNaN(date.getTime())
    ? `${normalized.toString()} ms`
    : date.toISOString();
}

export function safeJsonStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(value, (_key, currentValue) => {
      if (typeof currentValue === "bigint") {
        return currentValue.toString();
      }

      if (currentValue && typeof currentValue === "object") {
        if (seen.has(currentValue as object)) {
          return "[Circular]";
        }

        seen.add(currentValue as object);
      }

      return currentValue;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `[unserializable: ${message}]`;
  }
}

export function formatScaledInteger(
  value: bigint,
  decimals: number,
  trimTrailingZeros = true,
): string {
  const negative = value < 0n;
  const absoluteValue = negative ? -value : value;
  const scale = 10n ** BigInt(decimals);
  const whole = absoluteValue / scale;
  const fraction = absoluteValue % scale;
  const wholeLabel = addThousandsSeparators(whole.toString());
  const fractionLabel = (
    trimTrailingZeros
      ? fraction
          .toString()
          .padStart(decimals, "0")
          .replace(/0+$/, "")
      : fraction.toString().padStart(decimals, "0")
  );

  const prefix = negative ? "-" : "";
  return fractionLabel
    ? `${prefix}${wholeLabel}.${fractionLabel}`
    : `${prefix}${wholeLabel}`;
}
