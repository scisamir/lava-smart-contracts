import { mConStr0 } from "@meshsdk/core";
import {
  alwaysSuccessMintValidatorHash,
  multiSigAddress,
  multiSigCbor,
  multiSigUtxos,
  txBuilder,
  wallet1,
  wallet1Address,
  wallet1Utxos,
  wallet2,
  PrecisionFactor,
  MinPoolLovelace,
  blockchainProvider,
  tStrikeAssetName,
  tStrikePoolStakeAssetName,
  requireWallet1Collateral,
} from "../setup.js";
import {
  PoolValidatorAddr,
  PoolValidatorHash,
  PoolValidatorScript,
} from "./validator.js";
import { assetType, computePoolNftName, outputReferenceData, poolDatum, scriptCredential } from "../data.js";
import { BatchingHash } from "../batching/validator.js";
import { GlobalSettingsAddr } from "../global_settings/validator.js";

const poolAsset = assetType(
  alwaysSuccessMintValidatorHash,
  tStrikeAssetName,
  1_000_000,
);
const PoolDatum = poolDatum(
  scriptCredential(BatchingHash),
  0, // total_st_assets_minted
  0, // total_underlying
  1 * PrecisionFactor, // exchange_rate
  0, // total_rewards_accrued
  poolAsset,
  tStrikePoolStakeAssetName,
  true,
);

if (!multiSigCbor) {
  throw new Error("multisig cbor doesn't exist");
}

const wallet1Collateral = requireWallet1Collateral();
const seedUtxo = multiSigUtxos[0];
if (!seedUtxo) {
  throw new Error("No multisig UTxO available to create the pool");
}

const poolNftName = computePoolNftName(
  seedUtxo.input.txHash,
  seedUtxo.input.outputIndex,
);
const createPoolRedeemer = mConStr0([
  outputReferenceData(seedUtxo.input.txHash, seedUtxo.input.outputIndex),
]);

const gsUtxo = (
  await blockchainProvider.fetchAddressUTxOs(GlobalSettingsAddr)
)[0];

const unsignedTx = await txBuilder
  .txIn(
    seedUtxo.input.txHash,
    seedUtxo.input.outputIndex,
    seedUtxo.output.amount,
    seedUtxo.output.address,
  )
  .txInScript(multiSigCbor)
  .mintPlutusScriptV3()
  .mint("1", PoolValidatorHash, poolNftName)
  .mintingScript(PoolValidatorScript)
  .mintRedeemerValue(createPoolRedeemer)
  .txOut(PoolValidatorAddr, [
    { unit: "lovelace", quantity: String(MinPoolLovelace) },
    { unit: PoolValidatorHash + poolNftName, quantity: "1" },
  ])
  .txOutInlineDatumValue(PoolDatum)
  .txOut(multiSigAddress, seedUtxo.output.amount)
  .txInCollateral(
    wallet1Collateral.input.txHash,
    wallet1Collateral.input.outputIndex,
  )
  .setTotalCollateral("5000000")
  .readOnlyTxInReference(gsUtxo.input.txHash, gsUtxo.input.outputIndex)
  .changeAddress(wallet1Address)
  .selectUtxosFrom(wallet1Utxos)
  .complete();

const signedTx1 = await wallet1.signTx(unsignedTx, true);
const signedTx2 = await wallet2.signTx(signedTx1, true);

const txHash = await wallet1.submitTx(signedTx2);
console.log("Create strike pool tx hash:", txHash);
