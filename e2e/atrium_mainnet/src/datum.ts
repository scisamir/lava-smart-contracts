// src/datum.ts
//
// Encode and decode Plutus datums to/from the Mesh PlutusData JSON format.
// Every function here must produce CBOR that exactly matches the on-chain types.

import { deserializeDatum } from "@meshsdk/core";
import type { UTxO } from "@meshsdk/core";
import type { BasketState, ExRate, BasketLock, StakePoolDatum, PlutusData } from "./types.js";
import { safeJsonStringify, toSafeIntegerNumber } from "./safe.js";

/** Parse a raw datum value: JSON string, CBOR hex string, or already-parsed object */
export function parseDatum(raw: string | object): PlutusData {
  if (typeof raw !== "string") return raw as PlutusData;
  // JSON object or array
  if (raw.startsWith("{") || raw.startsWith("[")) return JSON.parse(raw) as PlutusData;
  // CBOR hex — use Mesh's CBOR deserializer
  return deserializeDatum(raw) as PlutusData;
}

// ─────────────────────────────────────────────────────────────
// ENCODING HELPERS
// ─────────────────────────────────────────────────────────────

/** Plutus constructor: Constr(n, [...fields]) */
function constr(n: number, fields: PlutusData[]): PlutusData {
  return { constructor: n, fields };
}

function normalizeConstructorValue(value: string | number | bigint): number {
  return toSafeIntegerNumber(value, "Constructor value");
}

/** Plutus integer */
function integer(n: bigint | number): PlutusData {
  return { int: typeof n === "number" ? BigInt(n) : n };
}

/** Plutus byte string (hex) */
function bytes(hex: string): PlutusData {
  return { bytes: hex };
}

/** Plutus Option: None = Constr(1, []), Some(x) = Constr(0, [x]) */
function option(value: PlutusData | null): PlutusData {
  if (value === null) return constr(1, []);
  return constr(0, [value]);
}

// ─────────────────────────────────────────────────────────────
// ENCODE: TypeScript → PlutusData JSON
// ─────────────────────────────────────────────────────────────

/**
 * Encode ExRate → List([numerator, denominator])
 *
 * PRational in Plutarch wraps PBuiltinPair, which encodes as a Plutus List,
 * NOT as a Constructor. Confirmed by the actual on-chain datum.
 */
export function encodeExRate(r: ExRate): PlutusData {
  return { list: [integer(r.numerator), integer(r.denominator)] };
}

/**
 * Encode BasketLock:
 *   Locked   → Constr(0, [lockedAt])
 *   Unlocked → Constr(1, [unlockedAt])
 */
export function encodeBasketLock(lock: BasketLock): PlutusData {
  if (lock.type === "Locked") {
    return constr(0, [integer(lock.lockedAt)]);
  } else {
    return constr(1, [integer(lock.unlockedAt)]);
  }
}

/**
 * Encode BasketState → Constr(0, [exRate, numOfStakePoolUtxos, lock, pledgeLock, adminPkh])
 *
 * This is the datum stored (by hash) on the basket-state UTxO.
 */
export function encodeBasketState(state: BasketState): PlutusData {
  return constr(0, [
    encodeExRate(state.exRate),
    integer(state.numOfStakePoolUtxos),
    encodeBasketLock(state.lock),
    encodeBasketLock(state.pledgeLock),
    bytes(state.adminPkh),
  ]);
}

/**
 * Encode StakePoolDatum → Constr(0, [Option<poolPkh>, basketTokenCounter])
 *
 * This is the inline datum on stake-pool UTxOs.
 */
export function encodeStakePoolDatum(datum: StakePoolDatum): PlutusData {
  return constr(0, [
    option(datum.poolPkh !== null ? bytes(datum.poolPkh) : null),
    integer(datum.basketTokenCounter),
  ]);
}

// ─────────────────────────────────────────────────────────────
// DECODE: PlutusData JSON → TypeScript
// ─────────────────────────────────────────────────────────────

/** Assert and extract a constructor value */
function decodeConstr(
  data: PlutusData,
  expectedAlternative?: number
): { constructor: number; fields: PlutusData[] } {
  if (!Object.prototype.hasOwnProperty.call(data, "constructor")) {
    throw new Error(`Expected constructor, got: ${safeJsonStringify(data)}`);
  }
  const constrData = data as {
    constructor: string | number | bigint;
    fields: PlutusData[];
  };
  const constructor = normalizeConstructorValue(constrData.constructor);

  if (expectedAlternative !== undefined && constructor !== expectedAlternative) {
    throw new Error(
      `Expected constructor ${expectedAlternative}, got ${String(
        constrData.constructor,
      )}`,
    );
  }
  return {
    constructor,
    fields: constrData.fields,
  };
}

/** Extract integer value */
function decodeInt(data: PlutusData): bigint {
  if (!("int" in data)) {
    throw new Error(`Expected int, got: ${safeJsonStringify(data)}`);
  }

  return BigInt(data.int);
}

/** Extract bytes value */
function decodeBytes(data: PlutusData): string {
  if (!("bytes" in data)) {
    throw new Error(`Expected bytes, got: ${safeJsonStringify(data)}`);
  }

  return data.bytes;
}

/** Decode Option<bytes>: Constr(0,[bytes]) → string, Constr(1,[]) → null */
function decodeOptionBytes(data: PlutusData): string | null {
  const { constructor, fields } = decodeConstr(data);
  if (constructor === 1) return null;   // None
  if (constructor === 0) return decodeBytes(fields[0]); // Some(bytes)
  throw new Error(`Invalid Option constructor: ${constructor}`);
}

/**
 * Decode ExRate from List([numerator, denominator])
 *
 * PRational encodes as a Plutus List (not a Constructor).
 */
export function decodeExRate(data: PlutusData): ExRate {
  if (!("list" in data)) {
    throw new Error(`Expected list for ExRate, got: ${safeJsonStringify(data)}`);
  }
  return {
    numerator: decodeInt(data.list[0]),
    denominator: decodeInt(data.list[1]),
  };
}

/**
 * Decode BasketLock from Constr(0,[lockedAt]) or Constr(1,[unlockedAt])
 */
export function decodeBasketLock(data: PlutusData): BasketLock {
  const { constructor, fields } = decodeConstr(data);
  if (constructor === 0) {
    return { type: "Locked", lockedAt: decodeInt(fields[0]) };
  } else if (constructor === 1) {
    return { type: "Unlocked", unlockedAt: decodeInt(fields[0]) };
  }
  throw new Error(`Invalid BasketLock constructor: ${constructor}`);
}

/**
 * Decode BasketState from Constr(0, [exRate, numSPUtxos, lock, pledgeLock, adminPkh])
 */
export function decodeBasketState(data: PlutusData): BasketState {
  const { fields } = decodeConstr(data, 0);
  return {
    exRate: decodeExRate(fields[0]),
    numOfStakePoolUtxos: decodeInt(fields[1]),
    lock: decodeBasketLock(fields[2]),
    pledgeLock: decodeBasketLock(fields[3]),
    adminPkh: decodeBytes(fields[4]),
  };
}

/**
 * Decode StakePoolDatum from Constr(0, [Option<poolPkh>, basketTokenCounter])
 */
export function decodeStakePoolDatum(data: PlutusData): StakePoolDatum {
  const { fields } = decodeConstr(data, 0);
  return {
    poolPkh: decodeOptionBytes(fields[0]),
    basketTokenCounter: decodeInt(fields[1]),
  };
}

// ─────────────────────────────────────────────────────────────
// UTxO DATUM EXTRACTION
// ─────────────────────────────────────────────────────────────

/**
 * Extract and decode the StakePoolDatum from a UTxO's inline datum.
 * Stake-pool UTxOs always use inline datums.
 */
export function getStakePoolDatumFromUtxo(utxo: UTxO): StakePoolDatum {
  const raw = utxo.output.plutusData;
  if (!raw) {
    throw new Error(
      `UTxO ${utxo.input.txHash}#${utxo.input.outputIndex} has no inline datum`
    );
  }
  return decodeStakePoolDatum(parseDatum(raw));
}

/**
 * Get the basket state datum from a UTxO.
 * The basket-state UTxO uses a datum hash, so `plutusData` holds the full datum
 * if Mesh/Blockfrost resolved it (they usually do in UTxO responses).
 */
export function getBasketStateDatumFromUtxo(utxo: UTxO): BasketState {
  const raw = utxo.output.plutusData;
  if (!raw) {
    throw new Error(
      `BasketState UTxO ${utxo.input.txHash}#${utxo.input.outputIndex} ` +
      `has no datum. Ensure your provider resolves datum hashes.`
    );
  }
  return decodeBasketState(parseDatum(raw));
}
