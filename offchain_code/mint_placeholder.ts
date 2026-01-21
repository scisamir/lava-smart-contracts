import {
  deserializeAddress,
  stringToHex,
  Asset,
  mConStr0,
} from "@meshsdk/core";
import {
  getTxBuilder,
  wallet,
  getPlaceholder,
  NETWORK,
} from "./common";

/**
 * Mint tokens using the Placeholder minting policy (always succeeds)
 *
 * Usage: npx ts-node mint_placeholder.ts
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Token name to mint (will be converted to hex)
  tokenName: "IAG",

  // Amount to mint
  amount: 1000000000000,

  // Submit transaction
  submitTx: true,
};

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("Placeholder Token Minting");
  console.log(`Network: ${NETWORK}`);
  console.log("=".repeat(60));

  const txBuilder = getTxBuilder();
  txBuilder.setNetwork(NETWORK);

  const walletAddress = await wallet.getChangeAddress();
  console.log("\nWallet Address:", walletAddress);

  const utxos = await wallet.getUtxos();
  console.log("Available UTxOs:", utxos.length);

  const { pubKeyHash } = deserializeAddress(walletAddress);

  // Get placeholder minting policy
  const placeholder = getPlaceholder();
  console.log("\nPlaceholder Policy ID:", placeholder.policyId);

  // Token details
  const tokenNameHex = stringToHex(CONFIG.tokenName);
  const tokenUnit = placeholder.policyId + tokenNameHex;

  console.log("Token Name:", CONFIG.tokenName);
  console.log("Token Name (hex):", tokenNameHex);
  console.log("Token Unit:", tokenUnit);
  console.log("Amount:", CONFIG.amount);

  // Find collateral UTxO (ADA only, >= 5 ADA)
  const collateralUtxo = utxos.find(
    (utxo) =>
      utxo.output.amount.length === 1 &&
      utxo.output.amount[0].unit === "lovelace" &&
      BigInt(utxo.output.amount[0].quantity) >= 5_000_000n
  );

  if (!collateralUtxo) {
    throw new Error("No suitable collateral UTxO found (need >= 5 ADA, only lovelace)");
  }

  console.log("Collateral UTxO:", collateralUtxo.input.txHash + "#" + collateralUtxo.input.outputIndex);

  // Output with minted tokens
  const outputValue: Asset[] = [
    { unit: "lovelace", quantity: "2000000" },
    { unit: tokenUnit, quantity: CONFIG.amount.toString() },
  ];

  // Mint redeemer (unused by placeholder, but required - using empty bytes)
  const mintRedeemer = mConStr0([]);

  console.log("\nBuilding transaction...");

  await txBuilder
    // Mint tokens
    .mintPlutusScriptV3()
    .mint(CONFIG.amount.toString(), placeholder.policyId, tokenNameHex)
    .mintingScript(placeholder.scriptCbor)
    .mintRedeemerValue(mintRedeemer)

    // Output with minted tokens
    .txOut(walletAddress, outputValue)

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
    console.log("\nMinted:", CONFIG.amount, CONFIG.tokenName);
    console.log("Policy ID:", placeholder.policyId);
    console.log("Token Unit:", tokenUnit);
  } else {
    console.log("\n=== Transaction NOT Submitted ===");
    console.log("Set CONFIG.submitTx = true to submit");
  }

  console.log("\n" + "=".repeat(60));
  console.log("MINTING COMPLETE");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
