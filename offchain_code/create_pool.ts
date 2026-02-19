import fs from "node:fs";
import {
  deserializeAddress,
  mConStr0,
  mConStr1,
  Asset,
  serializePlutusScript,
} from "@meshsdk/core";
import {
  getTxBuilder,
  blockchainProvider,
  wallet,
  getPool,
  NETWORK,
  NETWORK_ID,
} from "./common";
import { ADMIN_CONFIG } from "./config";

// NOTE: You need to install blakejs: npm install blakejs
// Or use: npm install --save blakejs
import { blake2b } from "blakejs";

/**
 * Create a Pool for staking IAG tokens
 *
 * Pool creation requirements (from pool.ak):
 * 1. Seed UTxO must be spent (one-shot minting)
 * 2. Pool NFT name = blake2b_224(concat(txHash, to_bytearray(from_int(outputIndex))))
 * 3. CreatPoolRedeemer = { utxo_ref: OutputReference }
 * 4. PoolDatum initial values:
 *    - total_st_assets_minted = 0
 *    - total_underlying = 0
 *    - exchange_rate = precision_factor (100_000)
 *    - total_rewards_accrued = 0
 *    - pool_stake_asset_name != ""
 *    - is_processing_open = True
 * 5. Admin must sign (SpendScriptSigner - spend UTxO from admin script)
 * 6. Pool asset must be in GlobalSettings.allowed_assets
 * 7. Pool output address: payment_credential = Script(policy_id), stake_credential = Some(Inline(Script(policy_id)))
 * 8. Pool value: only pool NFT + min_pool_lovelace
 */

const DEPLOYMENT_FILE = "deployment.json";

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Pool stake asset name (hex) - unique identifier for this pool
  // This is used to identify staking receipts for this specific pool
  poolStakeAssetName: "4c2d494147", // "L-IAG" in hex

  // Submit transaction
  submitTx: true,
};

// Precision factor from constants.ak
const PRECISION_FACTOR = 100_000;

// =============================================================================
// HELPER: Compute Pool NFT Name using blake2b_224
// =============================================================================

/**
 * Computes the pool NFT name according to the contract:
 * blake2b_224(concat(utxo_ref.transaction_id, to_bytearray(from_int(utxo_ref.output_index))))
 *
 * The Aiken `from_int` converts an integer to a string representation,
 * and `to_bytearray` converts that string to bytes.
 */
function computePoolNftName(txHash: string, outputIndex: number): string {
  // Convert txHash from hex string to Buffer
  const txHashBuffer = Buffer.from(txHash, "hex");

  // Convert outputIndex to string representation, then to bytes
  // Aiken's from_int converts int to string, to_bytearray converts string to bytes
  const indexStr = outputIndex.toString();
  const indexBuffer = Buffer.from(indexStr, "utf8");

  // Concatenate txHash + index bytes
  const combined = Buffer.concat([txHashBuffer, indexBuffer]);

  // blake2b_224 = 28 bytes = 224 bits
  const hash = blake2b(combined, undefined, 28);

  // Return as hex string
  return Buffer.from(hash).toString("hex");
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("Create Pool for Staking");
  console.log(`Network: ${NETWORK}`);
  console.log("=".repeat(60));

  // Load deployment info
  if (!fs.existsSync(DEPLOYMENT_FILE)) {
    throw new Error(`${DEPLOYMENT_FILE} not found. Run deploy.ts first.`);
  }
  const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, "utf-8"));

  const txBuilder = getTxBuilder();
  txBuilder.setNetwork(NETWORK);

  const walletAddress = await wallet.getChangeAddress();
  console.log("\nWallet Address:", walletAddress);

  const utxos = await wallet.getUtxos();
  console.log("Available UTxOs:", utxos.length);

  const { pubKeyHash } = deserializeAddress(walletAddress);

  // Get pool validator with correct parameters
  const pool = getPool(deployment.contracts.globalSettings.policyId);

  console.log("\nPool Contract:");
  console.log("  Script Hash:", pool.scriptHash);
  console.log("  Address:", pool.scriptAddr);

  // ==========================================================================
  // Find Seed UTxO for one-shot minting
  // ==========================================================================
  const seedUtxoRaw = utxos.find(
    (utxo) =>
      //utxo.output.amount.length === 1 &&
      utxo.output.amount[0].unit === "lovelace" &&
      BigInt(utxo.output.amount[0].quantity) >= 5_000_000n
  );

  if (!seedUtxoRaw) {
    throw new Error("No suitable seed UTxO found (need >= 5 ADA, only lovelace)");
  }

  const seedUtxo = {
    txHash: seedUtxoRaw.input.txHash,
    index: seedUtxoRaw.input.outputIndex,
  };

  console.log("\nSeed UTxO:", seedUtxo.txHash + "#" + seedUtxo.index);

  // ==========================================================================
  // Compute Pool NFT Name
  // ==========================================================================
  const poolNftName = computePoolNftName(seedUtxo.txHash, seedUtxo.index);
  const poolNftUnit = pool.scriptHash + poolNftName;

  console.log("\nPool NFT:");
  console.log("  Name (hex):", poolNftName);
  console.log("  Unit:", poolNftUnit);

  // ==========================================================================
  // Pool Address with Stake Credential
  // ==========================================================================
  // Pool output must have:
  // - payment_credential = Script(policy_id)
  // - stake_credential = Some(Inline(Script(policy_id)))
  const poolAddressWithStake = serializePlutusScript(
    { code: pool.scriptCbor, version: "V3" },
    pool.scriptHash, // stake credential = same script hash (inline)
    NETWORK_ID,true
  ).address;

  console.log("  Address (with stake):", poolAddressWithStake);

  // ==========================================================================
  // Find Collateral UTxO
  // ==========================================================================
  const collateralUtxo = utxos.find(
    (utxo) =>
      utxo.output.amount.length === 1 &&
      utxo.output.amount[0].unit === "lovelace" &&
      BigInt(utxo.output.amount[0].quantity) >= 3_000_000n //&&
      //(utxo.input.txHash !== seedUtxo.txHash || utxo.input.outputIndex !== seedUtxo.index)
  );

  if (!collateralUtxo) {
    throw new Error("No suitable collateral UTxO found (need >= 5 ADA, different from seed)");
  }

  console.log("\nCollateral UTxO:", collateralUtxo.input.txHash + "#" + collateralUtxo.input.outputIndex);

  // ==========================================================================
  // Fetch GlobalSettings UTxO (needed as reference input)
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
  // Fetch Admin Multisig UTxO
  // ==========================================================================
  console.log("\n--- Fetching Admin Multisig UTxO ---");
  console.log("Admin Multisig Address:", ADMIN_CONFIG.scriptAddress);

  const adminUtxos = await blockchainProvider.fetchAddressUTxOs(ADMIN_CONFIG.scriptAddress);
  console.log("Admin UTxOs found:", adminUtxos.length);

  if (adminUtxos.length === 0) {
    throw new Error(`No UTxOs at admin multisig address: ${ADMIN_CONFIG.scriptAddress}`);
  }

  const adminUtxo = adminUtxos[0];
  console.log("Using Admin UTxO:", adminUtxo.input.txHash + "#" + adminUtxo.input.outputIndex);

  // ==========================================================================
  // Build Pool Datum
  // ==========================================================================
  console.log("\n--- Building Pool Datum ---");

  // Get pool_batching_cred from deployment
  // Credential = Script(hash) = Constr1 [hash]
  const poolBatchingCred = mConStr1([deployment.contracts.poolBatching.scriptHash]);

  // AssetType for IAG token
  // AssetType = Constr0 [is_stable, policy_id, asset_name, multiplier]
  // Bool: False = Constr0 [], True = Constr1 []
  const iagAssetType = mConStr0([
    mConStr0([]), // is_stable = False
    deployment.datum.allowedAssets[0].policyId,
    deployment.datum.allowedAssets[0].assetName,
    BigInt(deployment.datum.allowedAssets[0].multiplier),
  ]);

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
  const poolDatum = mConStr0([
    poolBatchingCred,
    BigInt(0), // total_st_assets_minted = 0
    BigInt(0), // total_underlying = 0
    BigInt(PRECISION_FACTOR), // exchange_rate = precision_factor
    BigInt(0), // total_rewards_accrued = 0
    iagAssetType, // pool_asset (IAG)
    CONFIG.poolStakeAssetName, // pool_stake_asset_name (must be non-empty)
    mConStr1([]), // is_processing_open = True (Bool True = Constr1 [])
  ]);

  console.log("Pool Datum:");
  console.log("  pool_batching_cred:", deployment.contracts.poolBatching.scriptHash);
  console.log("  total_st_assets_minted: 0");
  console.log("  total_underlying: 0");
  console.log("  exchange_rate:", PRECISION_FACTOR);
  console.log("  total_rewards_accrued: 0");
  console.log("  pool_asset:", deployment.datum.allowedAssets[0].policyId + deployment.datum.allowedAssets[0].assetName);
  console.log("  pool_stake_asset_name:", CONFIG.poolStakeAssetName);
  console.log("  is_processing_open: True");

  // ==========================================================================
  // Build CreatPoolRedeemer
  // ==========================================================================
  // CreatPoolRedeemer = { utxo_ref: OutputReference }
  // OutputReference = Constr0 [txHash, index]
  const creatPoolRedeemer = mConStr0([
    mConStr0([seedUtxo.txHash, seedUtxo.index]),
  ]);

  console.log("\nCreatPoolRedeemer:");
  console.log("  utxo_ref:", seedUtxo.txHash + "#" + seedUtxo.index);

  // ==========================================================================
  // Output Value for Pool UTxO
  // ==========================================================================
  const minPoolLovelace = deployment.datum.minPoolLovelace;
  const poolOutputValue: Asset[] = [
    { unit: "lovelace", quantity: minPoolLovelace.toString() },
    { unit: poolNftUnit, quantity: "1" },
  ];

  console.log("\nPool Output Value:");
  console.log("  Lovelace:", minPoolLovelace);
  console.log("  Pool NFT:", poolNftUnit);

  // ==========================================================================
  // Build Transaction
  // ==========================================================================
  console.log("\n--- Building Transaction ---");

  await txBuilder
    // GlobalSettings reference input (required by pool validator)
    .readOnlyTxInReference(gsUtxo.input.txHash, gsUtxo.input.outputIndex)

    // Seed UTxO (one-shot minting)
    .txIn(seedUtxo.txHash, seedUtxo.index)

    // Admin multisig UTxO (satisfies is_signed_by for SpendScriptSigner)
    .txIn(
      adminUtxo.input.txHash,
      adminUtxo.input.outputIndex,
      adminUtxo.output.amount,
      adminUtxo.output.address
    )
    .txInScript(ADMIN_CONFIG.scriptCbor!)

    // Mint Pool NFT
    .mintPlutusScriptV3()
    .mint("1", pool.scriptHash, poolNftName)
    .mintingScript(pool.scriptCbor)
    .mintRedeemerValue(creatPoolRedeemer)

    // Pool output with datum (address has stake credential)
    .txOut(poolAddressWithStake, poolOutputValue)
    .txOutInlineDatumValue(poolDatum)

    // Return funds to admin multisig
    .txOut(ADMIN_CONFIG.scriptAddress, [{ unit: "lovelace", quantity: "10000000" }])

    // Collateral
    .txInCollateral(collateralUtxo.input.txHash, collateralUtxo.input.outputIndex)

    // Required signer
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
    console.log("\nPool created successfully!");
    console.log("Pool NFT:", poolNftUnit);
    console.log("Pool Address:", poolAddressWithStake);

    // Save pool info
    const poolInfo = {
      txHash,
      poolNftName,
      poolNftUnit,
      poolScriptHash: pool.scriptHash,
      poolAddress: poolAddressWithStake,
      poolStakeAssetName: CONFIG.poolStakeAssetName,
      poolAsset: {
        policyId: deployment.datum.allowedAssets[0].policyId,
        assetName: deployment.datum.allowedAssets[0].assetName,
      },
      poolBatchingScriptHash: deployment.contracts.poolBatching.scriptHash,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync("pool.json", JSON.stringify(poolInfo, null, 2));
    console.log("\nPool info saved to pool.json");
  } else {
    console.log("\n=== Transaction NOT Submitted ===");
    console.log("Set CONFIG.submitTx = true to submit");
  }

  console.log("\n" + "=".repeat(60));
  console.log("CREATE POOL COMPLETE");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
