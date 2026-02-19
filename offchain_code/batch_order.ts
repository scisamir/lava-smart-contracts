import fs from "node:fs";
import {
  deserializeAddress,
  mConStr0,
  mConStr1,
  Asset,
  serializePlutusScript,
  deserializeDatum,
} from "@meshsdk/core";
import {
  getTxBuilder,
  blockchainProvider,
  wallet,
  getPool,
  getPoolBatching,
  getMinting,
  getOrder,
  NETWORK,
  NETWORK_ID,
  VALIDATORS,
  blueprint,
} from "./common";
import { applyParamsToScript } from "@meshsdk/core-csl";

/**
 * Batch an Order - Process staking order
 *
 * This script:
 * 1. Spends the order UTxO (with ProcessOrder redeemer)
 * 2. Spends the pool UTxO (with ProcessPool redeemer)
 * 3. Updates the pool datum (total_underlying, total_st_assets_minted)
 * 4. Mints L-IAG tokens (receipt tokens)
 * 5. Burns the order NFT
 * 6. Sends L-IAG + remaining assets to the user's receiver_address
 *
 * Required withdrawals:
 * - pool_batching withdraw (triggers batching validation)
 *
 * Batching logic from pool_batching.ak:
 * - For OptIn: deposit_amount goes to pool, user receives (deposit_amount * precision_factor / exchange_rate) L-IAG
 * - exchange_rate starts at precision_factor (100_000) so initially 1:1
 */

const DEPLOYMENT_FILE = "deployment.json";
const ORDER_FILE = "order.json";
const POOL_FILE = "pool.json";
const REFERENCE_SCRIPTS_FILE = "reference_scripts.json";

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Batcher index in authorized_batchers list (0-indexed)
  batcherIndex: 0,

  // Submit transaction
  submitTx: true,
};

// Precision factor from constants.ak
const PRECISION_FACTOR = 100_000;

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("Batch Order - Process Staking");
  console.log(`Network: ${NETWORK}`);
  console.log("=".repeat(60));

  // Load deployment info
  if (!fs.existsSync(DEPLOYMENT_FILE)) {
    throw new Error(`${DEPLOYMENT_FILE} not found. Run deploy.ts first.`);
  }
  const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, "utf-8"));

  // Load order info
  if (!fs.existsSync(ORDER_FILE)) {
    throw new Error(`${ORDER_FILE} not found. Run create_order.ts first.`);
  }
  const orderInfo = JSON.parse(fs.readFileSync(ORDER_FILE, "utf-8"));

  // Load pool info
  if (!fs.existsSync(POOL_FILE)) {
    throw new Error(`${POOL_FILE} not found. Run create_pool.ts first.`);
  }
  const poolInfo = JSON.parse(fs.readFileSync(POOL_FILE, "utf-8"));

  // Load reference scripts info
  if (!fs.existsSync(REFERENCE_SCRIPTS_FILE)) {
    throw new Error(`${REFERENCE_SCRIPTS_FILE} not found. Run deploy_reference_scripts.ts first.`);
  }
  const referenceScripts = JSON.parse(fs.readFileSync(REFERENCE_SCRIPTS_FILE, "utf-8"));

  const txBuilder = getTxBuilder();
  txBuilder.setNetwork(NETWORK);

  const walletAddress = await wallet.getChangeAddress();
  console.log("\nWallet Address:", walletAddress);

  const utxos = await wallet.getUtxos();
  console.log("Available UTxOs:", utxos.length);

  const { pubKeyHash } = deserializeAddress(walletAddress);

  // ==========================================================================
  // Get Validators
  // ==========================================================================

  // Pool validator
  const pool = getPool(deployment.contracts.globalSettings.policyId);
  console.log("\nPool Contract:");
  console.log("  Script Hash:", pool.scriptHash);

  // Pool Batching validator
  const poolBatching = getPoolBatching(
    deployment.contracts.globalSettings.policyId,
    pool.scriptHash
  );
  console.log("\nPoolBatching Contract:");
  console.log("  Script Hash:", poolBatching.scriptHash);
  console.log("  Reward Address:", poolBatching.rewardAddress);

  // Minting validator (for L-IAG)
  const minting = getMinting(poolBatching.scriptHash, deployment.contracts.globalSettings.policyId);
  console.log("\nMinting Contract:");
  console.log("  Policy ID:", minting.policyId);

  // Order validator
  const order = getOrder(deployment.contracts.globalSettings.policyId, poolBatching.scriptHash);
  console.log("\nOrder Contract:");
  console.log("  Script Hash:", order.scriptHash);

  // ==========================================================================
  // Fetch GlobalSettings UTxO
  // ==========================================================================
  console.log("\n--- Fetching GlobalSettings UTxO ---");
  const gsAddress = deployment.contracts.globalSettings.address;
  const gsUtxos = await blockchainProvider.fetchAddressUTxOs(gsAddress);

  const gsNftUnit = deployment.globalSettingsNft.unit;
  const gsUtxo = gsUtxos.find((utxo) =>
    utxo.output.amount.some((asset) => asset.unit === gsNftUnit)
  );

  if (!gsUtxo) {
    throw new Error(`GlobalSettings UTxO not found with NFT: ${gsNftUnit}`);
  }
  console.log("GlobalSettings UTxO:", gsUtxo.input.txHash + "#" + gsUtxo.input.outputIndex);

  // ==========================================================================
  // Fetch Order UTxO
  // ==========================================================================
  console.log("\n--- Fetching Order UTxO ---");
  const orderAddress = orderInfo.orderAddress;
  const orderUtxos = await blockchainProvider.fetchAddressUTxOs(orderAddress);

  const orderUtxo = orderUtxos.find((utxo) =>
    utxo.output.amount.some((asset) => asset.unit === orderInfo.orderNftUnit)
  );

  if (!orderUtxo) {
    throw new Error(`Order UTxO not found with NFT: ${orderInfo.orderNftUnit}`);
  }
  console.log("Order UTxO:", orderUtxo.input.txHash + "#" + orderUtxo.input.outputIndex);

  // Parse order datum to get deposit_amount and receiver_address
  const orderDatumCbor = orderUtxo.output.plutusData;
  console.log("Order Datum CBOR:", orderDatumCbor);

  // ==========================================================================
  // Fetch Pool UTxO
  // ==========================================================================
  console.log("\n--- Fetching Pool UTxO ---");
  const poolAddressWithStake = serializePlutusScript(
    { code: pool.scriptCbor, version: "V3" },
    pool.scriptHash,
    NETWORK_ID, true
  ).address;

  const poolUtxos = await blockchainProvider.fetchAddressUTxOs(poolAddressWithStake);
  console.log("Pool UTxOs found:", poolUtxos.length);

  const poolUtxo = poolUtxos.find((utxo) =>
    utxo.output.amount.some((asset) => asset.unit === poolInfo.poolNftUnit)
  );

  if (!poolUtxo) {
    throw new Error(`Pool UTxO not found with NFT: ${poolInfo.poolNftUnit}`);
  }
  console.log("Pool UTxO:", poolUtxo.input.txHash + "#" + poolUtxo.input.outputIndex);

  // Parse pool datum
  const poolDatumCbor = poolUtxo.output.plutusData;
  console.log("Pool Datum CBOR:", poolDatumCbor);

  // ==========================================================================
  // Find Collateral UTxO
  // ==========================================================================
  const collateralUtxo = utxos.find(
    (utxo) =>
      utxo.output.amount.length === 1 &&
      utxo.output.amount[0].unit === "lovelace" &&
      BigInt(utxo.output.amount[0].quantity) >= 5_000_000n
  );

  if (!collateralUtxo) {
    throw new Error("No suitable collateral UTxO found");
  }
  console.log("\nCollateral UTxO:", collateralUtxo.input.txHash + "#" + collateralUtxo.input.outputIndex);

  // ==========================================================================
  // Calculate Batching Values
  // ==========================================================================
  console.log("\n--- Calculating Batching Values ---");

  // Get deposit amount from order (stored in order.json)
  const depositAmount = orderInfo.depositAmount;
  console.log("Deposit Amount:", depositAmount);

  // Get current pool values (from pool datum - for now using initial values)
  // In a real scenario, you'd parse the pool datum to get current values
  const currentTotalUnderlying = 0; // Initial pool has 0
  const currentTotalStAssetsMinted = 0; // Initial pool has 0
  const exchangeRate = PRECISION_FACTOR; // Initial exchange rate

  // Calculate L-IAG to mint: (deposit_amount * precision_factor) / exchange_rate
  const depositAmountPrecised = BigInt(depositAmount) * BigInt(PRECISION_FACTOR);
  const lIagToMint = depositAmountPrecised / BigInt(exchangeRate);

  console.log("Exchange Rate:", exchangeRate);
  console.log("L-IAG to Mint:", lIagToMint.toString());

  // Updated pool values
  const updatedTotalUnderlying = currentTotalUnderlying + depositAmount;
  const updatedTotalStAssetsMinted = currentTotalStAssetsMinted + Number(lIagToMint);

  console.log("Updated Total Underlying:", updatedTotalUnderlying);
  console.log("Updated Total ST Assets Minted:", updatedTotalStAssetsMinted);

  // ==========================================================================
  // Build Redeemers
  // ==========================================================================

  // ProcessOrder redeemer for order spend = Constr1 [] (ProcessOrder is index 1)
  const orderSpendRedeemer = mConStr1([]);

  // ProcessPool redeemer for pool spend = Constr0 [] (ProcessPool is index 0)
  const poolSpendRedeemer = mConStr0([]);

  // BatchingRedeemer for pool_batching withdraw
  // BatchingRedeemer = { batcher_index: Int, batching_asset: AssetType, pool_stake_asset_name: AssetName }
  const iagAssetType = mConStr0([
    mConStr0([]), // is_stable = False
    deployment.datum.allowedAssets[0].policyId,
    deployment.datum.allowedAssets[0].assetName,
    BigInt(deployment.datum.allowedAssets[0].multiplier),
  ]);

  const batchingRedeemer = mConStr0([
    BigInt(CONFIG.batcherIndex),
    iagAssetType,
    poolInfo.poolStakeAssetName, // "4c2d494147" (L-IAG)
  ]);

  // ==========================================================================
  // Build Updated Pool Datum
  // ==========================================================================

  // PoolDatum = Constr0 [
  //   pool_batching_cred,
  //   total_st_assets_minted,
  //   total_underlying,
  //   exchange_rate,
  //   total_rewards_accrued,
  //   pool_asset,
  //   pool_stake_asset_name,
  //   is_processing_open
  // ]
  const poolBatchingCred = mConStr1([poolBatching.scriptHash]); // Script credential

  const updatedPoolDatum = mConStr0([
    poolBatchingCred,
    BigInt(updatedTotalStAssetsMinted),
    BigInt(updatedTotalUnderlying),
    BigInt(exchangeRate),
    BigInt(0), // total_rewards_accrued unchanged
    iagAssetType, // pool_asset (IAG)
    poolInfo.poolStakeAssetName, // pool_stake_asset_name
    mConStr1([]), // is_processing_open = True
  ]);

  // ==========================================================================
  // Build Output Values
  // ==========================================================================

  // Pool output value: min_pool_lovelace + pool NFT + updated_total_underlying of IAG
  const minPoolLovelace = deployment.datum.minPoolLovelace;
  const iagUnit = deployment.datum.allowedAssets[0].policyId + deployment.datum.allowedAssets[0].assetName;

  const poolOutputValue: Asset[] = [
    { unit: "lovelace", quantity: minPoolLovelace.toString() },
    { unit: poolInfo.poolNftUnit, quantity: "1" },
    { unit: iagUnit, quantity: updatedTotalUnderlying.toString() },
  ];

  console.log("\nPool Output Value:", JSON.stringify(poolOutputValue, null, 2));

  // User output value: order value - order NFT - deposit_amount of IAG + L-IAG minted
  // Get order's lovelace and other assets
  const orderLovelace = orderUtxo.output.amount.find(a => a.unit === "lovelace")?.quantity || "0";
  const lIagUnit = minting.policyId + poolInfo.poolStakeAssetName;

  // User receives: lovelace + L-IAG (minus the deposited IAG and order NFT)
  const userOutputValue: Asset[] = [
    { unit: "lovelace", quantity: orderLovelace },
    { unit: lIagUnit, quantity: lIagToMint.toString() },
  ];

  // Add any extra IAG that wasn't deposited (if order had more than deposit_amount)
  const orderIagAmount = orderUtxo.output.amount.find(a => a.unit === iagUnit)?.quantity || "0";
  const extraIag = BigInt(orderIagAmount) - BigInt(depositAmount);
  if (extraIag > 0n) {
    userOutputValue.push({ unit: iagUnit, quantity: extraIag.toString() });
  }

  console.log("User Output Value:", JSON.stringify(userOutputValue, null, 2));

  // Receiver address from order info
  const receiverPubKeyHash = orderInfo.receiverPubKeyHash;

  // Build receiver address (payment credential only, no stake credential based on order datum)
  // Address = Constr0 [payment_credential, stake_credential]
  // For pubkey: payment_credential = Constr0 [pubKeyHash] (VerificationKey)
  // stake_credential = Constr1 [] (None)
  const { serializeAddressObj, pubKeyAddress } = await import("@meshsdk/core");
  const receiverAddress = serializeAddressObj(
    pubKeyAddress(receiverPubKeyHash),
    NETWORK_ID
  );
  console.log("Receiver Address:", receiverAddress);

  // ==========================================================================
  // Get Order Mint Script (for burning order NFT)
  // ==========================================================================
  const orderMintCredential = {
    alternative: 1,
    fields: [poolBatching.scriptHash]
  };

  const orderMintScriptCbor = applyParamsToScript(
    blueprint.validators[VALIDATORS.ORDER_MINT].compiledCode,
    [deployment.contracts.globalSettings.policyId, orderMintCredential],
    "Mesh"
  );

  // ==========================================================================
  // Find Wallet UTxO for Input
  // ==========================================================================
  // We need at least one wallet UTxO as input (Mesh won't add it automatically since tx is balanced)
  const walletInputUtxo = utxos.find(
    (utxo) =>
      utxo.input.txHash !== collateralUtxo.input.txHash ||
      utxo.input.outputIndex !== collateralUtxo.input.outputIndex
  );

  if (!walletInputUtxo) {
    throw new Error("No suitable wallet UTxO found for input (need at least 2 UTxOs: one for input, one for collateral)");
  }
  console.log("\nWallet Input UTxO:", walletInputUtxo.input.txHash + "#" + walletInputUtxo.input.outputIndex);

  // ==========================================================================
  // Build Transaction
  // ==========================================================================
  console.log("\n--- Building Transaction ---");
  console.log("Using reference scripts to reduce memory usage");

  await txBuilder
    // Add wallet UTxO as explicit input (required for transaction to be valid)
    .txIn(
      walletInputUtxo.input.txHash,
      walletInputUtxo.input.outputIndex,
      walletInputUtxo.output.amount,
      walletInputUtxo.output.address
    )

    // GlobalSettings reference input
    .readOnlyTxInReference(gsUtxo.input.txHash, gsUtxo.input.outputIndex)

    // Spend Order UTxO with ProcessOrder redeemer (attached script)
    .spendingPlutusScriptV3()
    .txIn(
      orderUtxo.input.txHash,
      orderUtxo.input.outputIndex,
      orderUtxo.output.amount,
      orderUtxo.output.address
    )
    .txInInlineDatumPresent()
    .txInRedeemerValue(orderSpendRedeemer)
    .txInScript(order.scriptCbor)

    // Spend Pool UTxO with ProcessPool redeemer (attached script)
    .spendingPlutusScriptV3()
    .txIn(
      poolUtxo.input.txHash,
      poolUtxo.input.outputIndex,
      poolUtxo.output.amount,
      poolUtxo.output.address
    )
    .txInInlineDatumPresent()
    .txInRedeemerValue(poolSpendRedeemer)
    .txInScript(pool.scriptCbor)

    // Pool Batching withdraw (triggers batching validation) - using reference script
    .withdrawalPlutusScriptV3()
    .withdrawal(poolBatching.rewardAddress, "0")
    .withdrawalRedeemerValue(batchingRedeemer)
    .withdrawalTxInReference(
      referenceScripts.poolBatching.txHash,
      referenceScripts.poolBatching.outputIndex,
      (poolBatching.scriptCbor.length / 2).toString(), // script size in bytes
      poolBatching.scriptHash
    )

    // Mint L-IAG tokens (using reference script)
    .mintPlutusScriptV3()
    .mint(lIagToMint.toString(), minting.policyId, poolInfo.poolStakeAssetName)
    .mintRedeemerValue(mConStr0([])) // Mint redeemer (any data works)
    .mintTxInReference(
      referenceScripts.minting.txHash,
      referenceScripts.minting.outputIndex,
      (minting.scriptCbor.length / 2).toString(), // script size in bytes
      minting.policyId
    )

    // Burn Order NFT (still attaching script - order mint not in reference scripts)
    .mintPlutusScriptV3()
    .mint("-1", orderInfo.orderMintPolicyId, orderInfo.orderNftName)
    .mintingScript(orderMintScriptCbor)
    .mintRedeemerValue(mConStr1([])) // BurnOrder = Constr1 []

    // Pool output with updated datum
    .txOut(poolAddressWithStake, poolOutputValue)
    .txOutInlineDatumValue(updatedPoolDatum)

    // User output with L-IAG tokens
    .txOut(receiverAddress, userOutputValue)

    // Collateral
    .txInCollateral(collateralUtxo.input.txHash, collateralUtxo.input.outputIndex)

    // Required signer (batcher)
    .requiredSignerHash(pubKeyHash)

    // Change
    .changeAddress(walletAddress)

    // UTxO selection
    .selectUtxosFrom(utxos)

    .complete();

  const unsignedTx = txBuilder.txHex;
  console.log("\n=== Unsigned Transaction CBOR ===");
  console.log(unsignedTx);

  const signedTx = await wallet.signTx(unsignedTx, true);
  console.log("\n=== Signed Transaction CBOR ===");
  console.log(signedTx);

  if (CONFIG.submitTx) {
    const txHash = await wallet.submitTx(signedTx);
    console.log("\n=== Transaction Submitted ===");
    console.log("TxHash:", txHash);
    console.log("\nOrder batched successfully!");
    console.log("L-IAG minted:", lIagToMint.toString());
    console.log("Receiver:", receiverAddress);
    console.log("Pool updated - Total Underlying:", updatedTotalUnderlying);
    console.log("Pool updated - Total ST Assets Minted:", updatedTotalStAssetsMinted);
  } else {
    console.log("\n=== Transaction NOT Submitted ===");
    console.log("Set CONFIG.submitTx = true to submit");
  }

  console.log("\n" + "=".repeat(60));
  console.log("BATCH ORDER COMPLETE");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
