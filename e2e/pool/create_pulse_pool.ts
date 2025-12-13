import { mConStr0, mConStr1 } from "@meshsdk/core";
import { alwaysSuccessMintValidatorHash, multiSigAddress, multiSigCbor, multiSigUtxos, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet2, PrecisionFactor, LavaPoolNftName, MinPoolLovelace, blockchainProvider, tPulseAssetName, tPulsePoolStakeAssetName } from "../setup.js";
import { PoolValidatorAddr, PoolValidatorHash, PoolValidatorScript } from "./validator.js";
import { BatchingHash } from "../batching/validator.js";
import { GlobalSettingsAddr } from "../global_settings/validator.js";

const poolAsset =
  mConStr0([
    mConStr0([]),
    alwaysSuccessMintValidatorHash,
    tPulseAssetName,
    1_000_000,
  ]);

const PoolDatum = mConStr0([
  mConStr1([BatchingHash]), // pool batching cred
  0, // total_st_assets_minted
  0, // total_underlying
  1 * PrecisionFactor, // exchange_rate
  0, // total_rewards_accrued
  poolAsset,
  tPulsePoolStakeAssetName,
  mConStr1([]),
]);

if (!multiSigCbor) {
    throw new Error("multisig cbor doesn't exist");
}

const gsUtxo = (await blockchainProvider.fetchAddressUTxOs(GlobalSettingsAddr))[0];

const unsignedTx = await txBuilder
    .txIn(
        multiSigUtxos[0].input.txHash,
        multiSigUtxos[0].input.outputIndex,
        multiSigUtxos[0].output.amount,
        multiSigUtxos[0].output.address,
    )
    .txInScript(multiSigCbor)
    .mintPlutusScriptV3()
    .mint("1", PoolValidatorHash, LavaPoolNftName)
    .mintingScript(PoolValidatorScript)
    .mintRedeemerValue("")
    .txOut(PoolValidatorAddr, [
      { unit: "lovelace", quantity: String(MinPoolLovelace) },
      { unit: PoolValidatorHash + LavaPoolNftName, quantity: "1" }
    ])
    .txOutInlineDatumValue(PoolDatum)
    // send back multisig value to multisig
    .txOut(multiSigAddress, multiSigUtxos[0].output.amount)
    .txInCollateral(
        wallet1Collateral.input.txHash,
        wallet1Collateral.input.outputIndex,
    )
    .setTotalCollateral("5000000")
    .readOnlyTxInReference(gsUtxo.input.txHash, gsUtxo.input.outputIndex)
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .complete()

const signedTx1 = await wallet1.signTx(unsignedTx, true);
const signedTx2 = await wallet2.signTx(signedTx1, true);

const txHash = await wallet1.submitTx(signedTx2);
console.log("Create pool tx hash:", txHash);
