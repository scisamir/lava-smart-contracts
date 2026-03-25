import { mConStr0, mConStr1, mPubKeyAddress } from "@meshsdk/core";
import {
  blockchainProvider,
  poolStakeAssetName,
  txBuilder,
  wallet1,
  wallet1Address,
  wallet1SK,
  wallet1Utxos,
  wallet1VK,
  requireWallet1Collateral,
} from "../setup.js";
import { orderDatum, redeemOrderType, verificationKeySigner } from "../data.js";
import { GlobalSettingsAddr } from "../global_settings/validator.js";
import { OrderValidatorAddr, OrderValidatorHash, OrderValidatorScript } from "./validator.js";
import { MintingHash } from "../mint/validator.js";

const stAmount = 200;
const orderData = orderDatum(
  redeemOrderType(stAmount),
  mPubKeyAddress(wallet1VK, wallet1SK),
  verificationKeySigner(wallet1VK),
  poolStakeAssetName,
);

const wallet1Collateral = requireWallet1Collateral();
const gsUtxo = (await blockchainProvider.fetchAddressUTxOs(GlobalSettingsAddr))[0];

const unsignedTx = await txBuilder
  .readOnlyTxInReference(gsUtxo.input.txHash, gsUtxo.input.outputIndex)
  .mintPlutusScriptV3()
  .mint("1", OrderValidatorHash, "")
  .mintingScript(OrderValidatorScript)
  .mintRedeemerValue(mConStr0([]))
  .txOut(OrderValidatorAddr, [
    { unit: "lovelace", quantity: "2000000" },
    { unit: OrderValidatorHash, quantity: "1" },
    { unit: MintingHash + poolStakeAssetName, quantity: String(stAmount) },
  ])
  .txOutInlineDatumValue(orderData)
  .txInCollateral(
    wallet1Collateral.input.txHash,
    wallet1Collateral.input.outputIndex,
  )
  .requiredSignerHash(wallet1VK)
  .changeAddress(wallet1Address)
  .selectUtxosFrom(wallet1Utxos)
  .complete();

const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);

console.log("Create redeem order tx hash:", txHash);
