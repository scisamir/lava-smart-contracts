import { mConStr1, mScriptAddress } from "@meshsdk/core";
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
  tPulseAssetName,
  tPulsePoolStakeAssetName,
  tStrikeAssetName,
  tStrikePoolStakeAssetName,
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
import { GlobalSettingsAddr, GlobalSettingsHash, GlobalSettingsValidatorScript } from "./validator.js";
import { MintingHash } from "../mint/validator.js";

const testAsset = assetType(
  alwaysSuccessMintValidatorHash,
  testAssetName,
  1_000_000,
);
const tStrikeAsset = assetType(
  alwaysSuccessMintValidatorHash,
  tStrikeAssetName,
  1_000_000,
);
const tPulseAsset = assetType(
  alwaysSuccessMintValidatorHash,
  tPulseAssetName,
  1_000_000,
);

const GlobalSettingsDatum = globalSettingsDatum(
  spendScriptSigner(multisigHash),
  [verificationKeySigner(wallet1VK)],
  [testAsset, tStrikeAsset, tPulseAsset],
  MintingHash,
  [
    stakeType(
      testAsset,
      poolStakeAssetName,
      mScriptAddress(alwaysSuccessMintValidatorHash),
      alwaysSuccessMintValidatorHash,
    ),
    stakeType(
      tStrikeAsset,
      tStrikePoolStakeAssetName,
      mScriptAddress(alwaysSuccessMintValidatorHash),
      alwaysSuccessMintValidatorHash,
    ),
    stakeType(
      tPulseAsset,
      tPulsePoolStakeAssetName,
      mScriptAddress(alwaysSuccessMintValidatorHash),
      alwaysSuccessMintValidatorHash,
    ),
  ],
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
const gsUtxo = (await blockchainProvider.fetchAddressUTxOs(GlobalSettingsAddr))[0];

const unsignedTx = await txBuilder
  .txIn(
    multiSigUtxos[0].input.txHash,
    multiSigUtxos[0].input.outputIndex,
    multiSigUtxos[0].output.amount,
    multiSigUtxos[0].output.address,
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
console.log("Update global settings tx hash:", txHash);
