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
import { optInOrderType, orderDatum, verificationKeySigner } from "../data.js";
import { GlobalSettingsAddr } from "../global_settings/validator.js";
import {
  OrderValidatorAddr,
  OrderValidatorHash,
  OrderValidatorScript,
} from "./validator.js";

const DEPOSIT_LOVELACE = 7_000_000n;

const orderData = orderDatum(
  optInOrderType(DEPOSIT_LOVELACE),
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
    { unit: "lovelace", quantity: (DEPOSIT_LOVELACE + 2_000_000n).toString() },
    { unit: OrderValidatorHash, quantity: "1" },
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

console.log("Create Atrium opt-in order tx hash:", txHash);
