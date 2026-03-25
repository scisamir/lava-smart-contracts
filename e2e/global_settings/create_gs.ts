import { mConStr0, mScriptAddress } from "@meshsdk/core";
import {
  alwaysSuccessMintValidatorHash,
  blockchainProvider,
  GlobalSettingsNft,
  MinPoolLovelace,
  multiSigAddress,
  multiSigCbor,
  multisigHash,
  multiSigUtxos,
  poolStakeAssetName,
  testAssetName,
  txBuilder,
  wallet1,
  wallet1Address,
  wallet1Utxos,
  wallet1VK,
  wallet2,
  requireWallet1Collateral,
} from "../setup.js";
import {
  assetType,
  globalSettingsDatum,
  spendScriptSigner,
  stakeType,
  verificationKeySigner,
} from "../data.js";
import {
  GlobalSettingsAddr,
  GlobalSettingsHash,
  GlobalSettingsValidatorScript,
  gsParamTxHash,
  gsParamTxIdx,
} from "./validator.js";
import { MintingHash } from "../mint/validator.js";

const testAsset = assetType(
  alwaysSuccessMintValidatorHash,
  testAssetName,
  1_000_000,
);

const testStakeDetail = stakeType(
  testAsset,
  poolStakeAssetName,
  mScriptAddress(alwaysSuccessMintValidatorHash),
  alwaysSuccessMintValidatorHash,
);

const GlobalSettingsDatum = globalSettingsDatum(
  spendScriptSigner(multisigHash),
  [verificationKeySigner(wallet1VK)],
  [testAsset],
  MintingHash,
  [testStakeDetail],
  mScriptAddress(alwaysSuccessMintValidatorHash),
  [alwaysSuccessMintValidatorHash],
  alwaysSuccessMintValidatorHash,
  alwaysSuccessMintValidatorHash,
  MinPoolLovelace,
);

if (!multiSigCbor) {
  throw new Error("multisig cbor doesn't exist");
}

const wallet1Collateral = requireWallet1Collateral();
const gsParamUtxo = (
  await blockchainProvider.fetchUTxOs(gsParamTxHash, gsParamTxIdx)
)[0];

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
  .txOut(GlobalSettingsAddr, [
    { unit: GlobalSettingsHash + GlobalSettingsNft, quantity: "1" },
  ])
  .txOutInlineDatumValue(GlobalSettingsDatum)
  .txOut(multiSigAddress, multiSigUtxos[0].output.amount)
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
console.log("Create global settings tx hash:", txHash);
