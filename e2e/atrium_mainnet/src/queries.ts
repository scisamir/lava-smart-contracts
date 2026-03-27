// src/queries.ts
//
// Query the blockchain for basket UTxOs.
// Wraps the Mesh/Blockfrost fetcher calls.

import type { UTxO } from "@meshsdk/core";
import { CONFIG, BASKET_STATE_UNIT, STAKE_POOL_UNIT } from "./config.js";
import { decodeBasketState, getStakePoolDatumFromUtxo, parseDatum } from "./datum.js";
import type { BasketState, StakePoolDatum, PlutusData } from "./types.js";

export interface BasketStateUtxo {
  utxo: UTxO;
  datum: BasketState;
  /** Raw CBOR hex of the basket-state datum (needed to add to tx datum witnesses) */
  rawDatumCbor: string;
}

export interface StakePoolUtxo {
  utxo: UTxO;
  datum: StakePoolDatum;
}

/**
 * Fetch all UTxOs at the basket validator address and separate them into:
 *   - basketState: the single UTxO carrying the BasketState NFT
 *   - stakePools:  all UTxOs carrying StakePool tokens
 *
 * @param fetcher  Any Mesh fetcher (e.g. BlockfrostProvider)
 */
export async function fetchBasketUtxos(
  fetcher: { fetchAddressUTxOs: (address: string) => Promise<UTxO[]>; get?: (url: string) => Promise<any> }
): Promise<{
  basketState: BasketStateUtxo;
  stakePools: StakePoolUtxo[];
}> {
  const utxos = await fetcher.fetchAddressUTxOs(CONFIG.basketValidatorAddress);

  // ── Basket-state UTxO ──────────────────────────────────────────────────────
  // Identified by holding exactly 1 of the basket_state_cs / "BasketState" token
  const bsUtxos = utxos.filter((utxo) =>
    utxo.output.amount.some(
      (a) => a.unit === BASKET_STATE_UNIT && BigInt(a.quantity) === 1n
    )
  );

  if (bsUtxos.length === 0) {
    throw new Error(
      "No basket-state UTxO found at the validator address. " +
        "Check that CONFIG.basketStateCS and CONFIG.basketStateTN are correct."
    );
  }
  if (bsUtxos.length > 1) {
    throw new Error(
      `Found ${bsUtxos.length} basket-state UTxOs — should be exactly 1. ` +
        "The protocol may be in an invalid state."
    );
  }

  const bsUtxo = bsUtxos[0];

  // BasketState uses a datum HASH (not inline). Resolve it via the provider.
  let basketStateDatum: BasketState;
  let rawDatumCbor: string;

  if (bsUtxo.output.plutusData) {
    // plutusData is the raw CBOR hex when already resolved
    rawDatumCbor = bsUtxo.output.plutusData;
    basketStateDatum = decodeBasketState(parseDatum(rawDatumCbor));
  } else if (bsUtxo.output.dataHash) {
    // Fetch the datum JSON from Blockfrost using the datum hash
    const jsonUrl = `https://cardano-mainnet.blockfrost.io/api/v0/scripts/datum/${bsUtxo.output.dataHash}`;
    const jsonResponse = fetcher.get
      ? await fetcher.get(jsonUrl)
      : await fetch(jsonUrl, { headers: { project_id: CONFIG.blockfrostApiKey } }).then((r) => r.json());
    const jsonValue = jsonResponse?.json_value ?? jsonResponse;
    basketStateDatum = decodeBasketState(jsonValue as PlutusData);

    // Also fetch the raw CBOR so we can add it to tx datum witnesses
    const cborUrl = `https://cardano-mainnet.blockfrost.io/api/v0/scripts/datum/${bsUtxo.output.dataHash}/cbor`;
    const cborResponse = fetcher.get
      ? await fetcher.get(cborUrl)
      : await fetch(cborUrl, { headers: { project_id: CONFIG.blockfrostApiKey } }).then((r) => r.json());
    rawDatumCbor = cborResponse?.cbor ?? cborResponse;
  } else {
    throw new Error(
      `BasketState UTxO ${bsUtxo.input.txHash}#${bsUtxo.input.outputIndex} ` +
      `has neither inline datum nor datum hash.`
    );
  }

  const basketState = { utxo: bsUtxo, datum: basketStateDatum, rawDatumCbor };

  // ── Stake-pool UTxOs ────────────────────────────────────────────────────────
  // Stake-pool UTxOs live at a separate address (stakePoolAddress).
  const spAllUtxos = await fetcher.fetchAddressUTxOs(CONFIG.stakePoolAddress);
  const spUtxos = spAllUtxos
    .filter((utxo) =>
      utxo.output.amount.some(
        (a) => a.unit === STAKE_POOL_UNIT && BigInt(a.quantity) === 1n
      )
    )
    .map((utxo) => ({
      utxo,
      datum: getStakePoolDatumFromUtxo(utxo),
    }));

  if (spUtxos.length === 0) {
    throw new Error(
      "No stake-pool UTxOs found. The basket may not have been initialised yet."
    );
  }

  return {
    basketState,
    stakePools: spUtxos,
  };
}

/**
 * Pick the best stake-pool UTxO for a deposit or withdrawal.
 *
 * Simple strategy: pick the one with the most lovelace (largest UTxO).
 * You could also pick randomly or by delegation target.
 */
export function pickStakePoolUtxo(stakePools: StakePoolUtxo[]): StakePoolUtxo {
  return stakePools.reduce((best, current) => {
    const bestLovelace = BigInt(
      best.utxo.output.amount.find((a) => a.unit === "lovelace")?.quantity ?? "0"
    );
    const currentLovelace = BigInt(
      current.utxo.output.amount.find((a) => a.unit === "lovelace")?.quantity ?? "0"
    );
    return currentLovelace > bestLovelace ? current : best;
  });
}

/**
 * Get the lovelace balance of a UTxO.
 */
export function getLovelace(utxo: UTxO): bigint {
  return BigInt(
    utxo.output.amount.find((a) => a.unit === "lovelace")?.quantity ?? "0"
  );
}

/**
 * Get wallet's basket token balance.
 */
export async function getBasketTokenBalance(
  fetcher: { fetchAddressUTxOs: (address: string) => Promise<UTxO[]> },
  walletAddress: string
): Promise<bigint> {
  const utxos = await fetcher.fetchAddressUTxOs(walletAddress);
  let total = 0n;
  for (const utxo of utxos) {
    for (const asset of utxo.output.amount) {
      if (asset.unit === CONFIG.basketTokenCS + CONFIG.basketTokenTN) {
        total += BigInt(asset.quantity);
      }
    }
  }
  return total;
}
