// src/types.ts
//
// TypeScript types that mirror the on-chain Plutus types exactly.
// Field order and nesting matches the CBOR encoding — important for
// building correct datums and redeemers.

// ─────────────────────────────────────────────────────────────
// ON-CHAIN TYPES
// ─────────────────────────────────────────────────────────────

/**
 * Exchange rate: lovelace per basket token.
 * Stored as a rational number so it can be compared and computed exactly.
 *
 * On-chain CBOR: List([numerator, denominator])  — PRational encodes as a Plutus List
 */
export interface ExRate {
  numerator: bigint;
  denominator: bigint;
}

/**
 * On-chain CBOR:
 *   Locked   → Constr(0, [locked_at_ms])
 *   Unlocked → Constr(1, [unlocked_at_ms])
 */
export type BasketLock =
  | { type: "Locked"; lockedAt: bigint }
  | { type: "Unlocked"; unlockedAt: bigint };

/**
 * Datum on the single basket-state UTxO.
 * Stored via datum HASH (not inline).
 *
 * On-chain CBOR: Constr(0, [ExRate, numOfStakePoolUtxos, lock, pledgeLock, adminPkh])
 */
export interface BasketState {
  exRate: ExRate;
  numOfStakePoolUtxos: bigint;
  lock: BasketLock;
  pledgeLock: BasketLock;
  adminPkh: string; // hex-encoded 28-byte pub key hash
}

/**
 * Datum on each stake-pool UTxO.
 * Stored INLINE.
 *
 * On-chain CBOR: Constr(0, [Option<poolPkh>, basketTokenCounter])
 */
export interface StakePoolDatum {
  poolPkh: string | null; // null = not delegating
  basketTokenCounter: bigint; // can be negative
}

// ─────────────────────────────────────────────────────────────
// REDEEMER CONSTRUCTORS (indices match Plutarch definition order)
// ─────────────────────────────────────────────────────────────

export const Redeemer = {
  Deposit: 0,
  Withdraw: 1,
  UpdateExRate: 2,
  Rebalance: 3,
  Donate: 4,
  StakePoolMPTriggerWitness: 5,
  RebalanceDelegate: 6,
  SwitchBasketLock: 7,
  SwitchPledgeLock: 8,
  SetAdmin: 9,
} as const;

// ─────────────────────────────────────────────────────────────
// MESH PLUTUS DATA FORMAT
// ─────────────────────────────────────────────────────────────

/**
 * Plutus data in Mesh JSON format.
 * Mesh uses this shape for datum / redeemer values when you pass "JSON" as the type.
 */
export type PlutusData =
  | { constructor: number; fields: PlutusData[] }   // Constr(n, [...])
  | { int: number | bigint }                         // Integer
  | { bytes: string }                                // ByteString (hex)
  | { list: PlutusData[] }                           // List
  | { map: { k: PlutusData; v: PlutusData }[] };     // Map

// ─────────────────────────────────────────────────────────────
// BASKET OPERATION INPUTS
// ─────────────────────────────────────────────────────────────

export interface DepositParams {
  /** How much ADA to deposit (in lovelace) */
  depositLovelace: bigint;
  /** bech32 wallet address to receive basket tokens and change */
  walletAddress: string;
}

export interface WithdrawParams {
  /** How many basket tokens to burn */
  basketTokensToBurn: bigint;
  /** bech32 wallet address to receive ADA and change */
  walletAddress: string;
}
