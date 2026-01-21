import fs from "node:fs";
import {
  deserializeAddress,
} from "@meshsdk/core";
import {
  getTxBuilder,
  wallet,
  getPoolBatching,
  NETWORK,
  NETWORK_ID,
} from "./common";

/**
 * Register the PoolBatching stake credential
 *
 * This is required before the pool_batching withdraw can be called for batching orders.
 * The stake credential needs to be registered on-chain first.
 */

const DEPLOYMENT_FILE = "deployment.json";

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Submit transaction
  submitTx: true,
};

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("Register PoolBatching Stake Credential");
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

  // Get PoolBatching validator
  const poolBatching = getPoolBatching(
    deployment.contracts.globalSettings.policyId,
    deployment.contracts.pool.scriptHash
  );

  console.log("\nPoolBatching Contract:");
  console.log("  Script Hash:", poolBatching.scriptHash);
  console.log("  Reward Address:", poolBatching.rewardAddress);

  // Find collateral UTxO
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

  console.log("\n--- Building Transaction ---");

  await txBuilder
    // Register the stake credential
    .registerStakeCertificate(poolBatching.rewardAddress)

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
    console.log("\nPoolBatching stake credential registered successfully!");
    console.log("Reward Address:", poolBatching.rewardAddress);
  } else {
    console.log("\n=== Transaction NOT Submitted ===");
    console.log("Set CONFIG.submitTx = true to submit");
  }

  console.log("\n" + "=".repeat(60));
  console.log("REGISTER POOL BATCHING COMPLETE");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
