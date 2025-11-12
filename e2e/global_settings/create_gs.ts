import { hexToString, mConStr0 } from "@meshsdk/core";
import { alwaysSuccessMintValidatorHash, blockchainProvider, GlobalSettingsNft, multiSigAddress, multiSigCbor, multisigHash, multiSigUtxos, txBuilder, testAssetName, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet2 } from "../setup.js";
import { GlobalSettingsAddr, GlobalSettingsHash, GlobalSettingsValidatorScript, gsParamTxHash, gsParamTxIdx } from "./validator.js";
import { MintingHash } from "../mint/validator.js";

const AllowedAssets = [
  mConStr0([
    mConStr0([]),
    alwaysSuccessMintValidatorHash,
    testAssetName,
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

const gsParamUtxo = (await blockchainProvider.fetchUTxOs(gsParamTxHash, gsParamTxIdx))[0];
console.log(GlobalSettingsNft, '\n');
console.log(hexToString("47534e"), '\n', ",,");

const unsignedTx = await txBuilder
    .txIn(
        gsParamUtxo.input.txHash,
        gsParamUtxo.input.outputIndex,
        gsParamUtxo.output.amount,
        gsParamUtxo.output.address,
    )
    .txIn(
        multiSigUtxos[0].input.txHash,
        multiSigUtxos[0].input.outputIndex,
        multiSigUtxos[0].output.amount,
        multiSigUtxos[0].output.address,
    )
    .txInScript(multiSigCbor)
    .mintPlutusScriptV3()
    .mint("1", GlobalSettingsHash, GlobalSettingsNft)
    .mintingScript(GlobalSettingsValidatorScript)
    .mintRedeemerValue(mConStr0([]))
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
console.log("Create global settings tx hash:", txHash);
