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
  getOrder,
  NETWORK,
  NETWORK_ID,
  VALIDATORS,
  blueprint,
} from "./common";
import { applyParamsToScript } from "@meshsdk/core-csl";
import { resolveScriptHash } from "@meshsdk/core";

/**
 * Create an Order to stake IAG tokens
 *
 * OrderDatum = Constr0 [order_type, receiver_address, canceller, pool_stake_asset_name]
 * OrderType:
 *   - OptIn (stake) = Constr0 [deposit_amount]
 *   - Redeem = Constr1 [st_amount]
 *
 * CreatOrderRedeemer:
 *   - MintOrder = Constr0 [utxo_ref]
 *   - BurnOrder = Constr1 []
 *
 * The order output address must have:
 *   - payment_credential = Script(order_script_hash)
 *   - stake_credential = Inline(Script(order_script_hash))
 */

const DEPLOYMENT_FILE = "deployment.json";

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Amount of IAG to stake (in smallest unit)
  depositAmount: 1_000_000_000, // 1000 IAG (assuming 6 decimals)

  // Pool stake asset name (hex) - identifies which pool to stake in, every pool has a unique assetname
  poolStakeAssetName: "4c2d494147", // "L-IAG" in hex

  // Submit transaction
  submitTx: true,
};

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("Create Staking Order");
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

  // Get order validator with correct parameters
  const order = getOrder(
    deployment.contracts.globalSettings.policyId,
    deployment.contracts.poolBatching.scriptHash
  );

  // Order address WITH stake credential (payment=script, stake=inline(script))
  const orderAddressWithStake = serializePlutusScript(
    { code: order.scriptCbor, version: "V3" },
    order.scriptHash, // stake credential = same script hash
    NETWORK_ID
  ).address;

  console.log("\nOrder Contract:");
  console.log("  Script Hash:", order.scriptHash);
  console.log("  Address (with stake):", orderAddressWithStake);

  // Get order minting script (ORDER_MINT validator)
  const orderMintCredential = {
    alternative: 1,
    fields: [deployment.contracts.poolBatching.scriptHash]
  };

  const orderMintScriptCbor = applyParamsToScript(
    blueprint.validators[VALIDATORS.ORDER_MINT].compiledCode,
    [deployment.contracts.globalSettings.policyId, orderMintCredential],
    "Mesh"
  );
  const orderMintPolicyId = resolveScriptHash(orderMintScriptCbor, "V3");

  console.log("  Mint Policy ID:", orderMintPolicyId);

  // Find collateral UTxO
  const collateralUtxo = utxos.find(
    (utxo) =>
      utxo.output.amount.length === 1 &&
      utxo.output.amount[0].unit === "lovelace" &&
      BigInt(utxo.output.amount[0].quantity) >= 3_000_000n
  );

  if (!collateralUtxo) {
    throw new Error("No suitable collateral UTxO found");
  }

  console.log("\nCollateral UTxO:", collateralUtxo.input.txHash + "#" + collateralUtxo.input.outputIndex);

  // Order NFT name is empty string (as per contract: expected_order_an = #"")
  const orderNftName = "";
  const orderNftUnit = orderMintPolicyId + orderNftName;

  console.log("\nOrder NFT:");
  console.log("  Name:", orderNftName);
  console.log("  Unit:", orderNftUnit);

  // Build receiver address datum (where tokens go after order is processed)
  // Address = Constr0 [payment_credential, stake_credential]
  // PaymentCredential = VerificationKey(hash) = Constr0 [hash]
  // StakeCredential = None = Constr1 []
  const receiverAddressDatum = mConStr0([
    mConStr0([pubKeyHash]), // payment credential (VerificationKey)
    mConStr1([]), // no stake credential
  ]);

  // OrderDatum = Constr0 [order_type, receiver_address, canceller, pool_stake_asset_name]
  // OrderType OptIn = Constr0 [deposit_amount]
  const orderType = mConStr0([BigInt(CONFIG.depositAmount)]); // OptIn

  // canceller is SignerType: VerificationKeySigner = Constr0 [pubKeyHash]
  const cancellerSigner = mConStr0([pubKeyHash]);

  const orderDatum = mConStr0([
    orderType,
    receiverAddressDatum,
    cancellerSigner, // canceller (VerificationKeySigner)
    CONFIG.poolStakeAssetName,
  ]);

  console.log("\nOrder Datum:");
  console.log("  Order Type: OptIn (stake)");
  console.log("  Deposit Amount:", CONFIG.depositAmount);
  console.log("  Receiver:", pubKeyHash);
  console.log("  Canceller:", pubKeyHash);
  console.log("  Pool Stake Asset Name:", CONFIG.poolStakeAssetName);

  // MintOrder redeemer = Constr0 []
  const mintRedeemer = mConStr0([]);

  // IAG token to deposit
  const iagPolicyId = deployment.datum.allowedAssets[0].policyId;
  const iagAssetName = deployment.datum.allowedAssets[0].assetName;
  const iagUnit = iagPolicyId + iagAssetName;

  console.log("\nIAG Token:");
  console.log("  Policy ID:", iagPolicyId);
  console.log("  Asset Name:", iagAssetName);
  console.log("  Unit:", iagUnit);

  // Fetch GlobalSettings UTxO (needed as reference input)
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

  // Output value for Order UTxO (ADA + Order NFT + IAG tokens to stake)
  const orderOutputValue: Asset[] = [
    { unit: "lovelace", quantity: "5000000" },
    { unit: orderNftUnit, quantity: "1" },
    { unit: iagUnit, quantity: CONFIG.depositAmount.toString() },
  ];

  console.log("\nBuilding transaction...");

  await txBuilder
    // GlobalSettings reference input (required by order mint validator)
    .readOnlyTxInReference(gsUtxo.input.txHash, gsUtxo.input.outputIndex)

    // Mint Order NFT
    .mintPlutusScriptV3()
    .mint("1", orderMintPolicyId, orderNftName)
    .mintingScript(orderMintScriptCbor)
    .mintRedeemerValue(mintRedeemer)

    // Order output with datum (address has stake credential)
    .txOut(orderAddressWithStake, orderOutputValue)
    .txOutInlineDatumValue(orderDatum)

    // Collateral
    .txInCollateral(collateralUtxo.input.txHash, collateralUtxo.input.outputIndex)

    // Required signer (receiver must sign)
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
    console.log("\nOrder created successfully!");
    console.log("Order NFT:", orderNftUnit);
    console.log("Order Address:", orderAddressWithStake);

    // Save order info for cancel script
    const orderInfo = {
      txHash,
      orderNftName,
      orderNftUnit,
      orderMintPolicyId,
      orderScriptHash: order.scriptHash,
      orderAddress: orderAddressWithStake,
      depositAmount: CONFIG.depositAmount,
      poolStakeAssetName: CONFIG.poolStakeAssetName,
      receiverPubKeyHash: pubKeyHash,
      canceller: pubKeyHash,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync("order.json", JSON.stringify(orderInfo, null, 2));
    console.log("\nOrder info saved to order.json");
  } else {
    console.log("\n=== Transaction NOT Submitted ===");
    console.log("Set CONFIG.submitTx = true to submit");
  }

  console.log("\n" + "=".repeat(60));
  console.log("CREATE ORDER COMPLETE");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
