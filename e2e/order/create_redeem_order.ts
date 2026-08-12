import { mConStr0, mPubKeyAddress } from "@meshsdk/core";
import {
  blockchainProvider,
  txBuilder,
  wallet1,
  wallet1Address,
  wallet1SK,
  wallet1Utxos,
  wallet1VK,
  requireWallet1Collateral,
  ATRIUM_POOL_STAKE_ASSET_NAME,
} from "../setup.js";
import { orderDatum, redeemOrderType, verificationKeySigner } from "../data.js";
import { GlobalSettingsAddr } from "../global_settings/validator.js";
import {
  OrderValidatorAddr,
  OrderValidatorHash,
  OrderValidatorScript,
} from "./validator.js";
import { MintingHash } from "../mint/validator.js";

const STAKE_ASSET_TO_REDEEM = 10_000_000n;

const orderData = orderDatum(
  redeemOrderType(STAKE_ASSET_TO_REDEEM),
  mPubKeyAddress(wallet1VK, wallet1SK),
  verificationKeySigner(wallet1VK),
  ATRIUM_POOL_STAKE_ASSET_NAME,
);

const wallet1Collateral = requireWallet1Collateral();
const gsUtxo = (
  await blockchainProvider.fetchAddressUTxOs(GlobalSettingsAddr)
)[0];

const unsignedTx = await txBuilder
  .readOnlyTxInReference(gsUtxo.input.txHash, gsUtxo.input.outputIndex)
  .mintPlutusScriptV3()
  .mint("1", OrderValidatorHash, "")
  .mintingScript(OrderValidatorScript)
  .mintRedeemerValue(mConStr0([]))
  .txOut(OrderValidatorAddr, [
    { unit: "lovelace", quantity: "2500000" },
    { unit: OrderValidatorHash, quantity: "1" },
    {
      unit: MintingHash + ATRIUM_POOL_STAKE_ASSET_NAME,
      quantity: STAKE_ASSET_TO_REDEEM.toString(),
    },
  ])
  .txOutInlineDatumValue(orderData)
  .txInCollateral(
    wallet1Collateral.input.txHash,
    wallet1Collateral.input.outputIndex,
  )
  .setTotalCollateral("5000000")
  .requiredSignerHash(wallet1VK)
  .changeAddress(wallet1Address)
  .selectUtxosFrom(wallet1Utxos)
  .complete();

const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);

console.log("Create Atrium redeem order tx hash:", txHash);
