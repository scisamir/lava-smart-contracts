import fs from "node:fs";
import readline from "node:readline";
import {
  deserializeAddress,
  mConStr0,
  mConStr1,
  stringToHex,
  Asset,
  mPubKeyAddress,
} from "@meshsdk/core";
import {
  getTxBuilder,
  blockchainProvider,
  wallet,
  getGlobalSettings,
  getMinting,
  getOrder,
  getPlaceholder,
  getPool,
  getPoolBatching,
  getRewards,
  getStake,
  getStrike,
  NETWORK,
  NETWORK_ID,
} from "./common";
import {
  CONFIG,
  ADMIN_CONFIG,
  buildAuthorizedBatchers,
} from "./config";

const DEPLOYMENT_FILE = "deployment.json";

/**
 * LAVA Smart Contracts Deployment Script
 *
 * Deployment Order (respecting dependencies):
 * 1. GlobalSettings (params: admin_sc, utxo_ref)
 * 2. Pool (params: gs_validator_hash)
 * 3. PoolBatching (params: gs_validator_hash, pool_validator_hash)
 * 4. Minting (params: pool_batching_cred, gs_validator_hash)
 * 5. Order (params: pool_batching_cred)
 * 6. Rewards (params: gs_validator_hash, pool_validator_hash)
 * 7. Stake (params: gs_validator_hash, pool_validator_hash)
 * 8. Strike (params: gs_validator_hash)
 */

async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

async function main() {
  console.log("=".repeat(60));
  console.log("LAVA Smart Contracts Deployment");
  console.log(`Network: ${NETWORK}`);
  console.log("=".repeat(60));

  // Check if deployment.json already exists
  if (fs.existsSync(DEPLOYMENT_FILE)) {
    console.log(`\n⚠️  ${DEPLOYMENT_FILE} already exists!`);
    const existingDeployment = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, "utf-8"));
    console.log("Previous deployment:");
    console.log(`  - Network: ${existingDeployment.network}`);
    console.log(`  - Date: ${existingDeployment.deployedAt}`);
    console.log(`  - TxHash: ${existingDeployment.txHash || "N/A"}`);
    console.log(`  - GlobalSettings: ${existingDeployment.contracts?.globalSettings?.policyId || "N/A"}`);

    const proceed = await askConfirmation("\nDo you want to overwrite and deploy again? (y/n): ");
    if (!proceed) {
      console.log("Deployment cancelled.");
      process.exit(0);
    }
    console.log("\nProceeding with new deployment...\n");
  }

  const txBuilder = getTxBuilder();
  txBuilder.setNetwork(NETWORK);

  const walletAddress = await wallet.getChangeAddress();
  console.log("\nWallet Address:", walletAddress);

  const utxos = await wallet.getUtxos();
  console.log("Available UTxOs:", utxos.length);

  const deserialized = deserializeAddress(walletAddress);
  const pubKeyHash = deserialized.pubKeyHash;

  // ==========================================================================
  // Find seed UTxO for one-shot minting
  // ==========================================================================
  const seedUtxoRaw = utxos.find(
    (utxo) =>
      utxo.output.amount.length === 1 &&
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
  // STEP 1: Calculate all script hashes
  // ==========================================================================
  console.log("\n--- Step 1: Calculating Script Hashes ---");

  const placeholder = getPlaceholder();
  console.log("Placeholder Policy ID:", placeholder.policyId);

  const globalSettings = getGlobalSettings(seedUtxo);
  console.log("GlobalSettings Policy ID:", globalSettings.policyId);
  console.log("GlobalSettings Address:", globalSettings.scriptAddr);

  const pool = getPool(globalSettings.policyId);
  console.log("Pool Script Hash:", pool.scriptHash);
  console.log("Pool Address:", pool.scriptAddr);

  const poolBatching = getPoolBatching(globalSettings.policyId, pool.scriptHash);
  console.log("PoolBatching Script Hash:", poolBatching.scriptHash);
  console.log("PoolBatching Reward Address:", poolBatching.rewardAddress);

  const minting = getMinting(poolBatching.scriptHash, globalSettings.policyId);
  console.log("Minting Policy ID:", minting.policyId);

  const order = getOrder(globalSettings.policyId, poolBatching.scriptHash);
  console.log("Order Script Hash:", order.scriptHash);
  console.log("Order Address:", order.scriptAddr);

  const rewards = getRewards(globalSettings.policyId, pool.scriptHash);
  console.log("Rewards Script Hash:", rewards.scriptHash);
  console.log("Rewards Address:", rewards.scriptAddr);

  const stake = getStake(globalSettings.policyId, pool.scriptHash);
  console.log("Stake Script Hash:", stake.scriptHash);
  console.log("Stake Reward Address:", stake.rewardAddress);

  const strike = getStrike(globalSettings.policyId);
  console.log("Strike Script Hash:", strike.scriptHash);
  console.log("Strike Reward Address:", strike.rewardAddress);

  // ==========================================================================
  // STEP 2: Build GlobalSettings Datum
  // ==========================================================================
  console.log("\n--- Step 2: Building GlobalSettings Datum ---");

  const authorizedBatchers = buildAuthorizedBatchers(
    CONFIG.globalSettingsDatum.authorizedBatchers
  );

  // Staked token config from deploy.ts (currently hardcoded IAG)
  const stakedTokenConfig = {
    isStable: false,
    policyId: "def68337867cb4f1f95b6b811fedbfcdd7780d10a95cc072077088ea",
    assetName: "494147", // "IAG" in hex
    multiplier: 1_000_000,
  };

  const stakedToken = mConStr0([
    stakedTokenConfig.isStable ? mConStr0([]) : mConStr0([]),
    stakedTokenConfig.policyId,
    stakedTokenConfig.assetName,
    BigInt(stakedTokenConfig.multiplier),
  ]);


  const stakeType=mConStr0([
    stakedToken,
    "4c2d494147", // "L-IAG" in hex - pool_stake_asset_name
    mConStr1([]), // None - address
    mConStr1([]), // None - datum_verifier_hash
  ]);

  // SignerType:
  // VerificationKeySigner = Constr0 [pubKeyHash]
  // SpendScriptSigner = Constr1 [scriptHash]
  // WithdrawScriptSigner = Constr2 [scriptHash]
  // MintScriptSigner = Constr3 [scriptHash]
  const adminSigner = mConStr1([CONFIG.adminScHash]); // SpendScriptSigner (spending UTxO from admin script)

  // GlobalSettingsDatum structure:
  // Constr0 [admin, authorized_batchers, allowed_assets, mint_validator_hash,
  //          stake_details, frost_address, authorized_swap_scripts,
  //          stake_validator_hash, rewards_validator_hash, min_pool_lovelace]
  const gsDatum = mConStr0([
    adminSigner,
    authorizedBatchers,
    [stakedToken],
    minting.policyId,
    [stakeType],  // stake_details
    mPubKeyAddress(CONFIG.globalSettingsDatum.authorizedBatchers[0]),
    [minting.policyId],
    stake.scriptHash,
    rewards.scriptHash,
    BigInt(CONFIG.globalSettingsDatum.minPoolLovelace),
  ]);

  console.log("Datum built with:");
  console.log("  - admin:", CONFIG.adminScHash);
  console.log("  - mint_validator_hash:", minting.policyId);
  console.log("  - stake_validator_hash:", stake.scriptHash);
  console.log("  - rewards_validator_hash:", rewards.scriptHash);

  // ==========================================================================
  // STEP 3: Build Deployment Info
  // ==========================================================================
  const gsNftNameHex = stringToHex(CONFIG.gsNftName);
  const gsNftUnit = globalSettings.policyId + gsNftNameHex;

  const deploymentInfo = {
    network: NETWORK,
    networkId: NETWORK_ID,
    deployedAt: new Date().toISOString(),
    txHash: "", // Will be updated after submission

    // Seed UTxO used for one-shot minting
    seedUtxo: seedUtxo,

    // Admin configuration
    admin: {
      scriptHash: CONFIG.adminScHash,
      scriptAddress: ADMIN_CONFIG.scriptAddress,
      walletAddresses: ADMIN_CONFIG.walletAddresses,
      keyHashes: ADMIN_CONFIG.keyHashes,
    },

    // GlobalSettings NFT
    globalSettingsNft: {
      name: CONFIG.gsNftName,
      nameHex: gsNftNameHex,
      unit: gsNftUnit,
    },

    // GlobalSettings Datum fields
    datum: {
      admin: CONFIG.adminScHash,
      authorizedBatchers: CONFIG.globalSettingsDatum.authorizedBatchers,
      allowedAssets: [stakedTokenConfig],
      mintValidatorHash: minting.policyId,
      stakeDetails: [],
      frostAddress: CONFIG.globalSettingsDatum.authorizedBatchers[0],
      authorizedSwapScripts: [minting.policyId],
      stakeValidatorHash: stake.scriptHash,
      rewardsValidatorHash: rewards.scriptHash,
      minPoolLovelace: CONFIG.globalSettingsDatum.minPoolLovelace,
    },

    // All contract addresses and hashes
    contracts: {
      globalSettings: {
        policyId: globalSettings.policyId,
        address: globalSettings.scriptAddr,
      },
      pool: {
        scriptHash: pool.scriptHash,
        address: pool.scriptAddr,
      },
      poolBatching: {
        scriptHash: poolBatching.scriptHash,
        rewardAddress: poolBatching.rewardAddress,
      },
      minting: {
        policyId: minting.policyId,
      },
      order: {
        scriptHash: order.scriptHash,
        address: order.scriptAddr,
      },
      rewards: {
        scriptHash: rewards.scriptHash,
        address: rewards.scriptAddr,
      },
      stake: {
        scriptHash: stake.scriptHash,
        rewardAddress: stake.rewardAddress,
      },
      strike: {
        scriptHash: strike.scriptHash,
        rewardAddress: strike.rewardAddress,
      },
      placeholder: {
        policyId: placeholder.policyId,
      },
    },
  };

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT INFO");
  console.log("=".repeat(60));
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // ==========================================================================
  // STEP 4: Build Transaction
  // ==========================================================================
  console.log("\n--- Step 4: Building Transaction ---");

  console.log("GS NFT Name:", CONFIG.gsNftName);
  console.log("GS NFT Name (hex):", gsNftNameHex);
  console.log("GS NFT Unit:", gsNftUnit);

  // Find collateral UTxO (ADA only, >= 5 ADA, different from seed)
  const collateralUtxo = utxos.find(
    (utxo) =>
      utxo.output.amount.length === 1 &&
      utxo.output.amount[0].unit === "lovelace" &&
      BigInt(utxo.output.amount[0].quantity) >= 5_000_000n //&&
     // (utxo.input.txHash !== seedUtxo.txHash || utxo.input.outputIndex !== seedUtxo.index)
  );

  if (!collateralUtxo) {
    throw new Error("No suitable collateral UTxO found (need >= 5 ADA, only lovelace)");
  }

  console.log("Collateral UTxO:", collateralUtxo.input.txHash + "#" + collateralUtxo.input.outputIndex);

  // Fetch admin multisig UTxO
  console.log("\n--- Fetching Admin Multisig UTxO ---");
  console.log("Admin Multisig Address:", ADMIN_CONFIG.scriptAddress);

  const adminUtxos = await blockchainProvider.fetchAddressUTxOs(ADMIN_CONFIG.scriptAddress);
  console.log("Admin UTxOs found:", adminUtxos.length);

  if (adminUtxos.length === 0) {
    throw new Error(`No UTxOs at admin multisig address: ${ADMIN_CONFIG.scriptAddress}`);
  }

  const adminUtxo = adminUtxos[0];
  console.log("Using Admin UTxO:", adminUtxo.input.txHash + "#" + adminUtxo.input.outputIndex);

  // Output value for GlobalSettings UTxO
  const gsOutputValue: Asset[] = [
    { unit: "lovelace", quantity: CONFIG.minUtxoAda.toString() },
    { unit: gsNftUnit, quantity: "1" },
  ];

  const mintRedeemer = mConStr0([]);

  console.log("\nBuilding transaction...");

  await txBuilder
    // Seed UTxO (one-shot minting)
    .txIn(seedUtxo.txHash, seedUtxo.index)

    // Admin multisig UTxO (satisfies is_multisig_signing)
    .txIn(
      adminUtxo.input.txHash,
      adminUtxo.input.outputIndex,
      adminUtxo.output.amount,
      adminUtxo.output.address
    )
    .txInScript(ADMIN_CONFIG.scriptCbor!)

    // Mint GlobalSettings NFT
    .mintPlutusScriptV3()
    .mint("1", globalSettings.policyId, gsNftNameHex)
    .mintingScript(globalSettings.scriptCbor)
    .mintRedeemerValue(mintRedeemer)

    // GlobalSettings output
    .txOut(globalSettings.scriptAddr, gsOutputValue)
    .txOutInlineDatumValue(gsDatum)

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

    // Update deployment info with txHash and save
    deploymentInfo.txHash = txHash;
    fs.writeFileSync(DEPLOYMENT_FILE, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\nDeployment info saved to ${DEPLOYMENT_FILE}`);
  } else {
    console.log("\n=== Transaction NOT Submitted ===");
    console.log("Set CONFIG.submitTx = true to submit");

    // Save deployment info without txHash
    fs.writeFileSync(DEPLOYMENT_FILE, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\nDeployment info saved to ${DEPLOYMENT_FILE} (no txHash - not submitted)`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
