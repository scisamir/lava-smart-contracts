import fs from "node:fs";
import {
  deserializeAddress,
  mConStr0,
  mConStr1,
  Asset,
  serializeAddressObj,
  pubKeyAddress,
} from "@meshsdk/core";
import {
  getTxBuilder,
  blockchainProvider,
  wallet,
  getOrder,
  NETWORK,
  NETWORK_ID,
  VALIDATORS,
  blueprint,
} from "./common";
import { applyParamsToScript } from "@meshsdk/core-csl";

/**
 * Cancel an Order and reclaim tokens
 *
 * The order validator cancel flow:
 * 1. spend handler with CancelOrder redeemer validates:
 *    - Order NFT is burned
 *    - Output goes to receiver_address with value minus NFT
 *    - Canceller must sign
 * 2. mint handler with BurnOrder redeemer burns the NFT
 */

const DEPLOYMENT_FILE = "deployment.json";
const ORDER_FILE = "order.json";

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  submitTx: true,
};

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("Cancel Staking Order");
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

  console.log("\nOrder Info:");
  console.log("  TxHash:", orderInfo.txHash);
  console.log("  Order NFT:", orderInfo.orderNftUnit);
  console.log("  Deposit Amount:", orderInfo.depositAmount);
  console.log("  Canceller:", orderInfo.canceller);

  const txBuilder = getTxBuilder();
  txBuilder.setNetwork(NETWORK);

  const walletAddress = await wallet.getChangeAddress();
  console.log("\nWallet Address:", walletAddress);

  const utxos = await wallet.getUtxos();
  console.log("Available UTxOs:", utxos.length);

  const { pubKeyHash } = deserializeAddress(walletAddress);

  // Verify we are the canceller
  if (pubKeyHash !== orderInfo.canceller) {
    throw new Error(`You are not the canceller. Expected: ${orderInfo.canceller}, Got: ${pubKeyHash}`);
  }

  // Get order validator
  const order = getOrder(
    deployment.contracts.globalSettings.policyId,
    deployment.contracts.poolBatching.scriptHash
  );

  console.log("\nOrder Contract:");
  console.log("  Script Hash:", order.scriptHash);

  // Get order minting script for burning
  const orderMintCredential = {
    alternative: 1,
    fields: [deployment.contracts.poolBatching.scriptHash]
  };

  const orderMintScriptCbor = applyParamsToScript(
    blueprint.validators[VALIDATORS.ORDER_MINT].compiledCode,
    [deployment.contracts.globalSettings.policyId, orderMintCredential],
    "Mesh"
  );

  // Fetch the order UTxO
  console.log("\n--- Fetching Order UTxO ---");
  const orderUtxos = await blockchainProvider.fetchAddressUTxOs(orderInfo.orderAddress);
  console.log("Order UTxOs at address:", orderUtxos.length);

  // Find our specific order UTxO by NFT
  const orderUtxo = orderUtxos.find((utxo) =>
    utxo.output.amount.some((asset) => asset.unit === orderInfo.orderNftUnit)
  );

  if (!orderUtxo) {
    throw new Error(`Order UTxO not found with NFT: ${orderInfo.orderNftUnit}`);
  }

  console.log("Found Order UTxO:", orderUtxo.input.txHash + "#" + orderUtxo.input.outputIndex);
  console.log("Order UTxO Amount:", JSON.stringify(orderUtxo.output.amount, null, 2));

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

  console.log("Collateral UTxO:", collateralUtxo.input.txHash + "#" + collateralUtxo.input.outputIndex);

  // Calculate output value (order value minus the NFT)
  const outputValue: Asset[] = orderUtxo.output.amount.filter(
    (asset) => asset.unit !== orderInfo.orderNftUnit
  );

  console.log("\nOutput to receiver:", JSON.stringify(outputValue, null, 2));

  // The receiver address from order.json should match what's in the datum
  // Build the receiver address from the pubKeyHash (no stake credential)
  const receiverAddress = serializeAddressObj(
    pubKeyAddress(orderInfo.receiverPubKeyHash),
    NETWORK_ID
  );
  console.log("Receiver address:", receiverAddress);

  // Redeemers
  // CancelOrder (spend) = Constr0 []
  const spendRedeemer = mConStr0([]);

  // BurnOrder (mint) = Constr1 []
  const burnRedeemer = mConStr1([]);

  // Fetch GlobalSettings UTxO (may be needed as reference input)
  console.log("\n--- Fetching GlobalSettings UTxO ---");
  const gsAddress = deployment.contracts.globalSettings.address;
  const gsUtxos = await blockchainProvider.fetchAddressUTxOs(gsAddress);

  const gsNftUnit = deployment.globalSettingsNft.unit;
  const gsUtxo = gsUtxos.find((utxo: any) =>
    utxo.output.amount.some((asset: any) => asset.unit === gsNftUnit)
  );

  if (!gsUtxo) {
    throw new Error(`GlobalSettings UTxO not found with NFT: ${gsNftUnit}`);
  }

  console.log("GlobalSettings UTxO:", gsUtxo.input.txHash + "#" + gsUtxo.input.outputIndex);

  console.log("\nBuilding transaction...");

  await txBuilder
    // GlobalSettings reference input
    .readOnlyTxInReference(gsUtxo.input.txHash, gsUtxo.input.outputIndex)

    // Spend the order UTxO with CancelOrder redeemer
    .spendingPlutusScriptV3()
    .txIn(
      orderUtxo.input.txHash,
      orderUtxo.input.outputIndex,
      orderUtxo.output.amount,
      orderUtxo.output.address
    )
    .txInInlineDatumPresent()
    .txInRedeemerValue(spendRedeemer)
    .txInScript(order.scriptCbor)

    // Burn the Order NFT
    .mintPlutusScriptV3()
    .mint("-1", orderInfo.orderMintPolicyId, orderInfo.orderNftName)
    .mintingScript(orderMintScriptCbor)
    .mintRedeemerValue(burnRedeemer)

    // Output to receiver (must match receiver_address in datum)
    .txOut(receiverAddress, outputValue)

    // Collateral
    .txInCollateral(collateralUtxo.input.txHash, collateralUtxo.input.outputIndex)

    // Required signer (canceller)
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
    console.log("\nOrder cancelled successfully!");
    console.log("Tokens reclaimed to:", walletAddress);

    // Remove order.json after successful cancellation
    fs.unlinkSync(ORDER_FILE);
    console.log(`\n${ORDER_FILE} removed.`);
  } else {
    console.log("\n=== Transaction NOT Submitted ===");
    console.log("Set CONFIG.submitTx = true to submit");
  }

  console.log("\n" + "=".repeat(60));
  console.log("CANCEL ORDER COMPLETE");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
