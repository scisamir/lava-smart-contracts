// src/math.ts
//
// Integer math for exchange rate calculations.
// All arithmetic uses bigint to avoid floating-point precision errors.

import type { ExRate } from "./types.js";
import { formatScaledInteger } from "./safe.js";

/**
 * Convert lovelace to basket tokens using the exchange rate.
 *
 *   tokens = floor(lovelace × denominator / numerator)
 *
 * The exchange rate is: ex_rate = numerator / denominator = lovelace per token.
 * Dividing lovelace by the rate gives tokens: lovelace / (num/den) = lovelace × den / num.
 *
 * Used on DEPOSIT to compute how many tokens to mint.
 */
export function lovelaceToBasketTokens(exRate: ExRate, lovelace: bigint): bigint {
  return (lovelace * exRate.denominator) / exRate.numerator;
}

/**
 * Convert basket tokens to lovelace using the exchange rate.
 *
 *   lovelace = floor(tokens × numerator / denominator)
 *
 * Used on WITHDRAWAL to compute how much ADA to release.
 */
export function basketTokensToLovelace(exRate: ExRate, tokens: bigint): bigint {
  return (tokens * exRate.numerator) / exRate.denominator;
}

/**
 * Compare two exchange rates as rationals (cross-multiply).
 * Returns true if a < b (new rate is higher, as expected after rewards accrue).
 *
 *   a < b  iff  a.num × b.den < b.num × a.den
 */
export function exRateLessThan(a: ExRate, b: ExRate): boolean {
  return a.numerator * b.denominator < b.numerator * a.denominator;
}

/**
 * Format an exchange rate as a human-readable ADA/token ratio.
 */
export function formatExRate(exRate: ExRate): string {
  if (exRate.denominator === 0n) {
    return "0.000000 ADA/token";
  }

  const scaledAdaPerToken =
    (exRate.numerator * 10n ** 6n) / (exRate.denominator * 1_000_000n);
  return `${formatScaledInteger(scaledAdaPerToken, 6, false)} ADA/token`;
}

/**
 * Format lovelace as ADA for display.
 */
export function formatLovelace(lovelace: bigint): string {
  return `${formatScaledInteger(lovelace, 6, false)} ADA`;
}
