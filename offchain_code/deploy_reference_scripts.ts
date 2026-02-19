import fs from "node:fs";
import {
  deserializeAddress,
  applyCborEncoding,
} from "@meshsdk/core";
import {
  getTxBuilder,
  wallet,
  getPool,
  getPoolBatching,
  getMinting,
  getOrder,
  NETWORK,
  NETWORK_ID,
} from "./common";

/**
 * Deploy Reference Scripts
 *
 * This script deploys the following validators as reference scripts:
 * 1. Pool validator
 * 2. PoolBatching validator
 * 3. Minting validator (for L-IAG)
 * 4. Order validator
 *
 * Reference scripts reduce transaction size and memory usage during batching.
 */

const DEPLOYMENT_FILE = "deployment.json";
const REFERENCE_SCRIPTS_FILE = "reference_scripts.json";

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Minimum ADA to lock with each reference script
  minUtxoAda: 40_000_000, // 40 ADA (reference scripts need more ADA)

  // Submit transaction
  submitTx: true,
};

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("Deploy Reference Scripts");
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

  // ==========================================================================
  // Get All Validators
  // ==========================================================================
  console.log("\n--- Getting Validators ---");

  // Pool validator
  const pool = getPool(deployment.contracts.globalSettings.policyId);
  console.log("Pool Script Hash:", pool.scriptHash);
  console.log("Pool Script Size:", pool.scriptCbor.length / 2, "bytes");

  // PoolBatching validator
  const poolBatching = getPoolBatching(
    deployment.contracts.globalSettings.policyId,
    pool.scriptHash
  );
  console.log("PoolBatching Script Hash:", poolBatching.scriptHash);
  console.log("PoolBatching Script Size:", poolBatching.scriptCbor.length / 2, "bytes");

  // Minting validator (for L-IAG)
  const minting = getMinting(poolBatching.scriptHash, deployment.contracts.globalSettings.policyId);
  console.log("Minting Policy ID:", minting.policyId);
  console.log("Minting Script Size:", minting.scriptCbor.length / 2, "bytes");

  // Order validator
  const order = getOrder(deployment.contracts.globalSettings.policyId, poolBatching.scriptHash);
  console.log("Order Script Hash:", order.scriptHash);
  console.log("Order Script Size:", order.scriptCbor.length / 2, "bytes");

  // Use pool script address for reference scripts (must go to a script address, not wallet)
  const referenceScriptAddress = pool.scriptAddr;
  console.log("\nReference Script Address:", referenceScriptAddress);

  // ==========================================================================
  // Build Transaction 1: Pool + PoolBatching
  // ==========================================================================
  console.log("\n--- Building Transaction 1 (Pool + PoolBatching) ---");

  const txBuilder1 = getTxBuilder();
  txBuilder1.setNetwork(NETWORK);

  await txBuilder1
    // Pool reference script output
    .txOut(referenceScriptAddress, [{ unit: "lovelace", quantity: CONFIG.minUtxoAda.toString() }])
    .txOutReferenceScript(pool.scriptCbor, "V3")

    // PoolBatching reference script output
    .txOut(referenceScriptAddress, [{ unit: "lovelace", quantity: CONFIG.minUtxoAda.toString() }])
    .txOutReferenceScript(poolBatching.scriptCbor, "V3")

    // Change
    .changeAddress(walletAddress)

    // UTxO selection
    .selectUtxosFrom(utxos)

    .complete();

  const unsignedTx1 = txBuilder1.txHex;
  console.log("\n=== Unsigned Transaction 1 CBOR ===");
  console.log(unsignedTx1);

  const signedTx1 = await wallet.signTx(unsignedTx1, true);
  console.log("\n=== Signed Transaction 1 CBOR ===");
  console.log(signedTx1);

  let txHash1 = "";
  if (CONFIG.submitTx) {
    txHash1 = await wallet.submitTx(signedTx1);
    console.log("\n=== Transaction 1 Submitted ===");
    console.log("TxHash:", txHash1);
    console.log("  Pool:         " + txHash1 + "#0");
    console.log("  PoolBatching: " + txHash1 + "#1");

    // Wait for transaction to be confirmed before building next tx
    console.log("\nWaiting 60 seconds for transaction to propagate...");
    await new Promise((resolve) => setTimeout(resolve, 60000));
  }

  // ==========================================================================
  // Build Transaction 2: Minting + Order
  // ==========================================================================
  console.log("\n--- Building Transaction 2 (Minting + Order) ---");

  // Refresh UTxOs after first transaction
  const utxos2 = await wallet.getUtxos();
  console.log("Available UTxOs:", utxos2.length);

  const txBuilder2 = getTxBuilder();
  txBuilder2.setNetwork(NETWORK);

  await txBuilder2
    // Minting reference script output
    .txOut(referenceScriptAddress, [{ unit: "lovelace", quantity: CONFIG.minUtxoAda.toString() }])
    .txOutReferenceScript(minting.scriptCbor, "V3")

    // Order reference script output
    .txOut(referenceScriptAddress, [{ unit: "lovelace", quantity: CONFIG.minUtxoAda.toString() }])
    .txOutReferenceScript(order.scriptCbor, "V3")

    // Change
    .changeAddress(walletAddress)

    // UTxO selection
    .selectUtxosFrom(utxos2)

    .complete();

  const unsignedTx2 = txBuilder2.txHex;
  console.log("\n=== Unsigned Transaction 2 CBOR ===");
  console.log(unsignedTx2);

  const signedTx2 = await wallet.signTx(unsignedTx2, true);
  console.log("\n=== Signed Transaction 2 CBOR ===");
  console.log(signedTx2);

  let txHash2 = "";
  if (CONFIG.submitTx) {
    txHash2 = await wallet.submitTx(signedTx2);
    console.log("\n=== Transaction 2 Submitted ===");
    console.log("TxHash:", txHash2);
    console.log("  Minting: " + txHash2 + "#0");
    console.log("  Order:   " + txHash2 + "#1");

    // Save reference script info
    const referenceScripts = {
      deployedAt: new Date().toISOString(),
      pool: {
        txHash: txHash1,
        outputIndex: 0,
        scriptHash: pool.scriptHash,
      },
      poolBatching: {
        txHash: txHash1,
        outputIndex: 1,
        scriptHash: poolBatching.scriptHash,
      },
      minting: {
        txHash: txHash2,
        outputIndex: 0,
        policyId: minting.policyId,
      },
      order: {
        txHash: txHash2,
        outputIndex: 1,
        scriptHash: order.scriptHash,
      },
    };

    fs.writeFileSync(REFERENCE_SCRIPTS_FILE, JSON.stringify(referenceScripts, null, 2));
    console.log(`\nReference scripts info saved to ${REFERENCE_SCRIPTS_FILE}`);

    console.log("\nReference Script UTxOs:");
    console.log(`  Pool:         ${txHash1}#0`);
    console.log(`  PoolBatching: ${txHash1}#1`);
    console.log(`  Minting:      ${txHash2}#0`);
    console.log(`  Order:        ${txHash2}#1`);
  } else {
    console.log("\n=== Transactions NOT Submitted ===");
    console.log("Set CONFIG.submitTx = true to submit");
  }

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOY REFERENCE SCRIPTS COMPLETE");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
