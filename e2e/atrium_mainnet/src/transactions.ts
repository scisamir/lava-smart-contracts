// src/transactions.ts
//
// Build deposit and withdrawal transactions for the Atrium basket protocol.
//
// Each function returns an unsigned transaction hex that can be signed
// and submitted by the wallet.

import { MeshTxBuilder, type UTxO } from "@meshsdk/core";
import { applyParamsToScript } from "@meshsdk/core-csl";
import { CONFIG, STAKE_POOL_UNIT } from "./config.js";
import { encodeStakePoolDatum, encodeBasketState } from "./datum.js";
import { lovelaceToBasketTokens, basketTokensToLovelace, formatExRate, formatLovelace } from "./math.js";
import { fetchBasketUtxos, pickStakePoolUtxo, getLovelace } from "./queries.js";
import type { DepositParams, WithdrawParams, PlutusData, BasketState } from "./types.js";


// ─────────────────────────────────────────────────────────────
// REDEEMER BUILDERS
// ─────────────────────────────────────────────────────────────

/** Deposit redeemer: Constr(0, []) */
const DEPOSIT_REDEEMER: PlutusData = { constructor: 0, fields: [] };

/** Withdraw redeemer: Constr(1, []) */
const WITHDRAW_REDEEMER: PlutusData = { constructor: 1, fields: [] };

// ─────────────────────────────────────────────────────────────
// DEPOSIT
// ─────────────────────────────────────────────────────────────

/**
 * Build a deposit transaction.
 *
 * What happens on-chain:
 *   1. A stake-pool UTxO is consumed and reproduced with (lovelace + depositAmount)
 *   2. Basket tokens are minted: floor(depositLovelace / exRate)
 *   3. The stake-pool datum's basketTokenCounter is incremented
 *   4. The basket-state UTxO is used as a reference input (not consumed)
 *
 * @param params          Deposit parameters (amount + wallet address)
 * @param provider        Mesh fetcher/evaluator (e.g. BlockfrostProvider)
 * @param walletUtxos     UTxOs from the user's wallet (for collateral + fees)
 * @param collateralUtxo  A wallet UTxO to use as collateral (≥ 5 ADA, no tokens)
 *
 * @returns Unsigned transaction CBOR hex (sign with wallet before submitting)
 */
export async function buildDepositTx(
  params: DepositParams,
  provider: any, // BlockfrostProvider or compatible
  walletUtxos: UTxO[],
  collateralUtxo: UTxO
): Promise<string> {
  const { depositLovelace, walletAddress } = params;

  // ── 1. Fetch current basket state ──────────────────────────────────────────
  const { basketState, stakePools } = await fetchBasketUtxos(provider);
  const spUtxoInfo = pickStakePoolUtxo(stakePools);
  const spUtxo = spUtxoInfo.utxo;
  const spDatum = spUtxoInfo.datum;
  const state: BasketState = basketState.datum;

  // ── 2. Check basket is unlocked ────────────────────────────────────────────
  if (state.lock.type === "Locked") {
    throw new Error(
      `Basket is currently LOCKED (locked at ${new Date(Number(state.lock.lockedAt)).toISOString()}). ` +
        "Deposits are not allowed while the basket is locked."
    );
  }

  // ── 3. Compute tokens to mint ──────────────────────────────────────────────
  const tokensToMint = lovelaceToBasketTokens(state.exRate, depositLovelace);
  if (tokensToMint <= 0n) {
    throw new Error(
      `Deposit amount too small. At current rate (${formatExRate(state.exRate)}), ` +
        `${formatLovelace(depositLovelace)} yields 0 basket tokens.`
    );
  }

  console.log(`Depositing ${formatLovelace(depositLovelace)}`);
  console.log(`Current exchange rate: ${formatExRate(state.exRate)}`);
  console.log(`Basket tokens to mint: ${tokensToMint}`);

  // ── 4. Build output datum (stake-pool UTxO datum updated) ──────────────────
  const currentLovelace = getLovelace(spUtxo);
  const outputLovelace = currentLovelace + depositLovelace;

  const outputSpDatum = encodeStakePoolDatum({
    poolPkh: spDatum.poolPkh,
    basketTokenCounter: spDatum.basketTokenCounter + tokensToMint,
  });

  // ── 5. Build the transaction ───────────────────────────────────────────────
  const protocolParams = await provider.fetchProtocolParameters();
  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    evaluator: provider,
    params: protocolParams,
    verbose: true,
  });

  const unsignedTx = await txBuilder
    // ── Spend: stake-pool UTxO (with Deposit redeemer) ──────────────────────
    .spendingPlutusScriptV2()
    .txIn(
      spUtxo.input.txHash,
      spUtxo.input.outputIndex,
      spUtxo.output.amount,
      spUtxo.output.address
    )
    .txInInlineDatumPresent()
    .txInRedeemerValue(DEPOSIT_REDEEMER, "JSON")
    .spendingTxInReference(CONFIG.refScriptTxHash, CONFIG.refScriptTxIndex)

    // ── Reference input: basket-state UTxO (read-only) ───────────────────────
    // The basket validator reads the exRate and lock status from here.
    // The basket-state datum (hash datum) is added to the witness set below via
    // post-processing, since Mesh has no direct API for standalone datum witnesses.
    .readOnlyTxInReference(
      basketState.utxo.input.txHash,
      basketState.utxo.input.outputIndex
    )
    .txInDatumValue(encodeBasketState(state), "JSON")

    // ── Mint: basket tokens ──────────────────────────────────────────────────
    // The basket token MP delegates to the basket validator (checks SP UTxO consumed)
    .mintPlutusScriptV2()
    .mint(tokensToMint.toString(), CONFIG.basketTokenCS, CONFIG.basketTokenTN)
    .mintingScript(applyParamsToScript(CONFIG.basketTokenMPCbor, []))
    .mintRedeemerValue({ constructor: 0, fields: [] }, "JSON") // redeemer unused

    // ── Output: propagated stake-pool UTxO (at same address, more ADA) ────────
    .txOut(spUtxo.output.address, [
      { unit: "lovelace", quantity: outputLovelace.toString() },
      { unit: STAKE_POOL_UNIT, quantity: "1" },
    ])
    .txOutInlineDatumValue(outputSpDatum, "JSON")

    // ── Collateral (required for Plutus scripts) ────────────────────────────
    .txInCollateral(
      collateralUtxo.input.txHash,
      collateralUtxo.input.outputIndex,
      collateralUtxo.output.amount,
      collateralUtxo.output.address
    )

    // ── Metadata ─────────────────────────────────────────────────────────────
    .metadataValue(674, { msg: ["Atrium minting from Lava"] })

    // ── Change goes back to wallet ──────────────────────────────────────────
    .changeAddress(walletAddress)
    .selectUtxosFrom(walletUtxos)
    .complete();

  return unsignedTx;
}

// ─────────────────────────────────────────────────────────────
// WITHDRAW
// ─────────────────────────────────────────────────────────────

/**
 * Build a withdrawal transaction.
 *
 * What happens on-chain:
 *   1. A stake-pool UTxO is consumed and reproduced with (lovelace - releasedLovelace)
 *   2. Basket tokens are burned: basketTokensToBurn
 *   3. ADA is released: floor(basketTokensToBurn × exRate)
 *   4. The stake-pool datum's basketTokenCounter is decremented
 *   5. The basket-state UTxO is used as a reference input
 *
 * @param params          Withdrawal parameters (tokens to burn + wallet address)
 * @param provider        Mesh fetcher/evaluator
 * @param walletUtxos     UTxOs from the user's wallet (must include basket tokens)
 * @param collateralUtxo  A wallet UTxO for collateral (≥ 5 ADA, no script tokens)
 *
 * @returns Unsigned transaction CBOR hex
 */
export async function buildWithdrawTx(
  params: WithdrawParams,
  provider: any,
  walletUtxos: UTxO[],
  collateralUtxo: UTxO
): Promise<string> {
  const { basketTokensToBurn, walletAddress } = params;

  if (basketTokensToBurn <= 0n) {
    throw new Error("basketTokensToBurn must be positive");
  }

  // ── 1. Fetch current basket state ──────────────────────────────────────────
  const { basketState, stakePools } = await fetchBasketUtxos(provider);
  const spUtxoInfo = pickStakePoolUtxo(stakePools);
  const spUtxo = spUtxoInfo.utxo;
  const spDatum = spUtxoInfo.datum;
  const state: BasketState = basketState.datum;

  // ── 2. Check basket is unlocked (both main lock and pledge lock) ────────────
  if (state.lock.type === "Locked") {
    throw new Error(
      `Basket is LOCKED (locked at ${new Date(Number(state.lock.lockedAt)).toISOString()}). ` +
        "Withdrawals are blocked while the basket is locked."
    );
  }
  if (state.pledgeLock.type === "Locked") {
    throw new Error(
      `Basket PLEDGE LOCK is active (locked at ${new Date(Number(state.pledgeLock.lockedAt)).toISOString()}). ` +
        "Withdrawals are blocked during pledge commitment periods."
    );
  }

  // ── 3. Compute ADA to release ──────────────────────────────────────────────
  const lovelaceToRelease = basketTokensToLovelace(state.exRate, basketTokensToBurn);
  if (lovelaceToRelease <= 0n) {
    throw new Error("Computed release amount is 0. Check basket token amount.");
  }

  // ── 4. Check stake-pool UTxO has enough ADA ────────────────────────────────
  const currentLovelace = getLovelace(spUtxo);
  // Keep at least 2 ADA (min UTxO) in the stake-pool UTxO
  const minUtxoLovelace = 2_000_000n;
  if (currentLovelace - lovelaceToRelease < minUtxoLovelace) {
    throw new Error(
      `The selected stake-pool UTxO only has ${formatLovelace(currentLovelace)}. ` +
        `Releasing ${formatLovelace(lovelaceToRelease)} would drop it below minimum. ` +
        "Try a smaller withdrawal or wait for rebalancing."
    );
  }

  console.log(`Burning ${basketTokensToBurn} basket tokens`);
  console.log(`Current exchange rate: ${formatExRate(state.exRate)}`);
  console.log(`ADA to receive: ${formatLovelace(lovelaceToRelease)}`);

  const outputLovelace = currentLovelace - lovelaceToRelease;

  // ── 5. Build output datum ──────────────────────────────────────────────────
  const outputSpDatum = encodeStakePoolDatum({
    poolPkh: spDatum.poolPkh,
    basketTokenCounter: spDatum.basketTokenCounter - basketTokensToBurn,
  });

  // ── 6. Build the transaction ───────────────────────────────────────────────
  const protocolParams = await provider.fetchProtocolParameters();
  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    evaluator: provider,
    params: protocolParams,
    verbose: true,
  });

  const unsignedTx = await txBuilder
    // ── Spend: stake-pool UTxO (with Withdraw redeemer) ──────────────────────
    .spendingPlutusScriptV2()
    .txIn(
      spUtxo.input.txHash,
      spUtxo.input.outputIndex,
      spUtxo.output.amount,
      spUtxo.output.address
    )
    .txInInlineDatumPresent()
    .txInRedeemerValue(WITHDRAW_REDEEMER, "JSON")
    .spendingTxInReference(CONFIG.refScriptTxHash, CONFIG.refScriptTxIndex)

    // ── Reference input: basket-state UTxO ──────────────────────────────────
    .readOnlyTxInReference(
      basketState.utxo.input.txHash,
      basketState.utxo.input.outputIndex
    )
    .txInDatumValue(encodeBasketState(state), "JSON")

    // ── Burn: basket tokens (negative mint amount) ────────────────────────────
    .mintPlutusScriptV2()
    .mint((-basketTokensToBurn).toString(), CONFIG.basketTokenCS, CONFIG.basketTokenTN)
    .mintingScript(applyParamsToScript(CONFIG.basketTokenMPCbor, []))
    .mintRedeemerValue({ constructor: 0, fields: [] }, "JSON")

    // ── Output: propagated stake-pool UTxO (less ADA) ────────────────────────
    .txOut(spUtxo.output.address, [
      { unit: "lovelace", quantity: outputLovelace.toString() },
      { unit: STAKE_POOL_UNIT, quantity: "1" },
    ])
    .txOutInlineDatumValue(outputSpDatum, "JSON")

    // ── Collateral ────────────────────────────────────────────────────────────
    .txInCollateral(
      collateralUtxo.input.txHash,
      collateralUtxo.input.outputIndex,
      collateralUtxo.output.amount,
      collateralUtxo.output.address
    )

    // ── Metadata ─────────────────────────────────────────────────────────────
    .metadataValue(674, { msg: ["Atrium withdraw from Lava"] })

    // ── Change ────────────────────────────────────────────────────────────────
    .changeAddress(walletAddress)
    .selectUtxosFrom(walletUtxos)
    .complete();

  return unsignedTx;
}
