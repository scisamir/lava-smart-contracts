import { deserializeDatum, mConStr1 } from "@meshsdk/core";
import {
  blockchainProvider,
  multiSigAddress,
  multiSigCbor,
  multiSigUtxos,
  requireWallet1Collateral,
  txBuilder,
  wallet1,
  wallet1Address,
  wallet1Utxos,
  wallet2,
} from "../setup.js";
import {
  GlobalSettingsAddr,
  GlobalSettingsValidatorScript,
} from "../global_settings/validator.js";
import {
  AdminControllerHash,
  AdminControllerRewardAddress,
  AdminControllerScript,
} from "./validator.js";

if (!multiSigCbor) {
  throw new Error("multisig cbor doesn't exist");
}

const adminUtxo = multiSigUtxos[0];
if (!adminUtxo) {
  throw new Error("No multisig UTxO available to authorize the migration");
}

const gsUtxo = (
  await blockchainProvider.fetchAddressUTxOs(GlobalSettingsAddr)
)[0];
if (!gsUtxo) {
  throw new Error("Global settings UTxO not found");
}
if (!gsUtxo.output.plutusData) {
  throw new Error("Global settings datum not found");
}

const currentGlobalSettings = deserializeDatum<any>(gsUtxo.output.plutusData);
if (currentGlobalSettings.fields?.length !== 9) {
  throw new Error("Global settings uses a different schema");
}

const updatedGlobalSettings = {
  ...currentGlobalSettings,
  fields: [
    { constructor: 2, fields: [{ bytes: AdminControllerHash }] },
    ...currentGlobalSettings.fields.slice(1),
  ],
};

const wallet1Collateral = requireWallet1Collateral();

const unsignedTx = await txBuilder
  .txIn(
    adminUtxo.input.txHash,
    adminUtxo.input.outputIndex,
    adminUtxo.output.amount,
    adminUtxo.output.address,
  )
  .txInScript(multiSigCbor)
  .spendingPlutusScriptV3()
  .txIn(
    gsUtxo.input.txHash,
    gsUtxo.input.outputIndex,
    gsUtxo.output.amount,
    gsUtxo.output.address,
  )
  .txInScript(GlobalSettingsValidatorScript)
  .txInInlineDatumPresent()
  .txInRedeemerValue(mConStr1([]))
  .txOut(GlobalSettingsAddr, gsUtxo.output.amount)
  .txOutInlineDatumValue(updatedGlobalSettings, "JSON")
  .txOut(multiSigAddress, adminUtxo.output.amount)
  .withdrawalPlutusScriptV3()
  .withdrawal(AdminControllerRewardAddress, "0")
  .withdrawalScript(AdminControllerScript)
  .withdrawalRedeemerValue(mConStr1([]))
  .txInCollateral(
    wallet1Collateral.input.txHash,
    wallet1Collateral.input.outputIndex,
  )
  .setTotalCollateral("5000000")
  .changeAddress(wallet1Address)
  .selectUtxosFrom(wallet1Utxos)
  .complete();

const signedTx1 = await wallet1.signTx(unsignedTx, true);
const signedTx2 = await wallet2.signTx(signedTx1, true);
const txHash = await wallet1.submitTx(signedTx2);

console.log("Admin controller hash:", AdminControllerHash);
console.log("Migrate admin controller tx hash:", txHash);
