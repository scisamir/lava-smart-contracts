import { mConStr0, mConStr1, stringToHex } from "@meshsdk/core";
import { alwaysSuccessMintValidatorHash, blockchainProvider, GlobalSettingsNft, multiSigAddress, multiSigCbor, multisigHash, multiSigUtxos, testAssetName, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet2 } from "../setup.js";
import { GlobalSettingsAddr, GlobalSettingsHash, GlobalSettingsValidatorScript } from "./validator.js";
import { MintingHash } from "../mint/validator.js";

const newAssetName = stringToHex("newTest");
const AllowedAssets = [
  mConStr0([
    mConStr0([]),
    alwaysSuccessMintValidatorHash,
    testAssetName,
    1_000_000,
  ]),
  mConStr0([
    mConStr0([]),
    alwaysSuccessMintValidatorHash,
    newAssetName,
    1_000_000,
  ]),
];

const GlobalSettingsDatum = mConStr0([
  multisigHash, // admin
  [multisigHash], // authorized batchers
  AllowedAssets,
  MintingHash,
]);


if (!multiSigCbor) {
    throw new Error("multisig cbor doesn't exist");
}

const gsUtxo = (await blockchainProvider.fetchAddressUTxOs(GlobalSettingsAddr))[0];

const unsignedTx = await txBuilder
    // signing utxo
    .txIn(
        multiSigUtxos[0].input.txHash,
        multiSigUtxos[0].input.outputIndex,
        multiSigUtxos[0].output.amount,
        multiSigUtxos[0].output.address,
    )
    .txInScript(multiSigCbor)
    // global settings utxo
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
    // send global settings
    .txOut(GlobalSettingsAddr, [{ unit: GlobalSettingsHash + GlobalSettingsNft, quantity: "1" }])
    .txOutInlineDatumValue(GlobalSettingsDatum)
    // send back multisig value to multisig
    .txOut(multiSigAddress, multiSigUtxos[0].output.amount)
    .txInCollateral(
        wallet1Collateral.input.txHash,
        wallet1Collateral.input.outputIndex,
        wallet1Collateral.output.amount,
        wallet1Collateral.output.address,
    )
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .complete()

const signedTx1 = await wallet1.signTx(unsignedTx, true);
const signedTx2 = await wallet2.signTx(signedTx1, true);

const txHash = await wallet1.submitTx(signedTx2);
console.log("Update global settings tx hash:", txHash);
