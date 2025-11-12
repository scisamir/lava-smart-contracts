import { deserializeDatum, mConStr0, mConStr1, serializeAddressObj } from "@meshsdk/core";
import { alwaysSuccessMintValidatorHash, batchingScriptTxHash, batchingScriptTxIdx, blockchainProvider, LavaPoolNftName, MinPoolLovelace, multiSigCbor, multiSigUtxos, poolStakeAssetName, testAssetName, testUnit, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet1VK, wallet2 } from "../setup.js"
import { OrderValidatorAddr, OrderValidatorRewardAddress, OrderValidatorScript } from "../order/validator.js";
import { PoolValidatorAddr, PoolValidatorHash, PoolValidatorScript } from "../pool/validator.js";
import { BatchingHash, BatchingRewardAddress, BatchingValidatorScript } from "./validator.js";
import { GlobalSettingsAddr } from "../global_settings/validator.js";
import { OrderDatumType, PoolDatumType } from "../types.js";
import { MintingHash, MintingValidatorScript } from "../mint/validator.js";

const orderUtxos = await blockchainProvider.fetchAddressUTxOs(OrderValidatorAddr);
const orderUtxo = orderUtxos[orderUtxos.length - 1];
const poolUtxo = (await blockchainProvider.fetchAddressUTxOs(PoolValidatorAddr))[0];

const orderPlutusData = orderUtxo.output.plutusData;
if (!orderPlutusData) throw new Error('No plutus data');
const orderDatum = deserializeDatum<OrderDatumType>(orderPlutusData);

let isOptIn = false;
if (Number(orderDatum.fields[0].constructor) === 0) {
    isOptIn = true;
}
const orderReceiverAddr = serializeAddressObj(orderDatum.fields[1]);
const mintAmtDatum = Number(orderDatum.fields[0].fields[0].int);
const mintAmount = isOptIn ? mintAmtDatum : -1 * mintAmtDatum;
console.log("order amount:", orderUtxo.output.amount);

// console.log(orderUtxos);
if (!orderUtxo) {
    throw new Error("order utxo not found!");
}

const BatchingRedeemer = mConStr0([
    0, // batcher index
    mConStr0([ // batching asset
        mConStr0([]),
        alwaysSuccessMintValidatorHash,
        testAssetName,
        1_000_000,
  ]),
]);

const gsUtxo = (await blockchainProvider.fetchAddressUTxOs(GlobalSettingsAddr))[0];

const orderLovelace = orderUtxo.output.amount.find(amt => amt.unit === "lovelace");
const orderLovelaceAmount = orderLovelace!.quantity;

const poolAssetAmount = orderUtxo.output.amount.find(amt => amt.unit === testUnit)?.quantity;
const updatedPoolAssetAmount = Number(poolAssetAmount) + mintAmount;

const poolPlutusData = poolUtxo.output.plutusData;
if (!poolPlutusData) throw new Error('No plutus data');
const poolDatum = deserializeDatum<PoolDatumType>(poolPlutusData);
const updatedTotalStMinted = Number(poolDatum.fields[1].int) + mintAmount;
const updatedTotalUnderlying = Number(poolDatum.fields[2].int) + mintAmount;

const poolAsset =
  mConStr0([
    mConStr0([]),
    alwaysSuccessMintValidatorHash,
    testAssetName,
    1_000_000,
  ]);
const upatedPoolDatum = mConStr0([
  mConStr1([BatchingHash]), // pool batching cred
  updatedTotalStMinted, // total_st_assets_minted
  updatedTotalUnderlying, // total_underlying
  poolDatum.fields[3].int, // exchange_rate
  poolDatum.fields[4].int, // total_rewards_accrued
  poolAsset,
  poolStakeAssetName,
]);

const unsignedTx = await txBuilder
    .txIn(
        multiSigUtxos[0].input.txHash,
        multiSigUtxos[0].input.outputIndex,
        multiSigUtxos[0].output.amount,
        multiSigUtxos[0].output.address,
    )
    .txInScript(multiSigCbor!)
    // spend order utxo
    .spendingPlutusScriptV3()
    .txIn(
        orderUtxo.input.txHash,
        orderUtxo.input.outputIndex,
        orderUtxo.output.amount,
        orderUtxo.output.address,
    )
    .txInScript(OrderValidatorScript)
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue("")
    // withdraw zero (order)
    .withdrawalPlutusScriptV3()
    .withdrawal(OrderValidatorRewardAddress, "0")
    .withdrawalScript(OrderValidatorScript)
    .withdrawalRedeemerValue(mConStr1([]))
    // spend pool utxo
    .spendingPlutusScriptV3()
    .txIn(
        poolUtxo.input.txHash,
        poolUtxo.input.outputIndex,
        poolUtxo.output.amount,
        poolUtxo.output.address,
    )
    .txInScript(PoolValidatorScript)
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue("")
    // withdraw zero (pool batching)
    .withdrawalPlutusScriptV3()
    .withdrawal(BatchingRewardAddress, "0")
    .withdrawalTxInReference(batchingScriptTxHash, batchingScriptTxIdx, undefined, BatchingHash)
    .withdrawalRedeemerValue(BatchingRedeemer)
    // mint stake tokens
    .mintPlutusScriptV3()
    .mint(String(mintAmount), MintingHash, poolStakeAssetName)
    .mintingScript(MintingValidatorScript)
    .mintRedeemerValue(mConStr0([]))
    // tx out (user order output)
    .txOut(orderReceiverAddr, [
        { unit: "lovelace", quantity: orderLovelaceAmount },
        { unit: MintingHash + poolStakeAssetName, quantity: String(mintAmount) },
    ])
    // pool output
    .txOut(PoolValidatorAddr, [
        { unit: "lovelace", quantity: String(MinPoolLovelace) },
        { unit: PoolValidatorHash + LavaPoolNftName, quantity: "1" },
        { unit: testUnit, quantity: String(updatedPoolAssetAmount) }
    ])
    .txOutInlineDatumValue(upatedPoolDatum)
    // ref input (global settings)
    .readOnlyTxInReference(gsUtxo.input.txHash, gsUtxo.input.outputIndex)
    .txInCollateral(
        wallet1Collateral.input.txHash,
        wallet1Collateral.input.outputIndex,
        wallet1Collateral.output.amount,
        wallet1Collateral.output.address,
    )
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .requiredSignerHash(wallet1VK)
    .complete()

// const signedTx = await wallet1.signTx(unsignedTx);
// const txHash = await wallet1.submitTx(signedTx);

// console.log("Batching orders tx hash:", txHash);

const signedTx1 = await wallet1.signTx(unsignedTx, true);
const signedTx2 = await wallet2.signTx(signedTx1, true);

const txHash = await wallet1.submitTx(signedTx2);
console.log("batching tx hash:", txHash);
