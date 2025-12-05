import { deserializeDatum, mConStr0, mConStr1, serializeAddressObj } from "@meshsdk/core";
import { alwaysSuccessMintValidatorHash, batchingScriptTxHash, batchingScriptTxIdx, blockchainProvider, LavaPoolNftName, MinPoolLovelace, multiSigCbor, multiSigUtxos, poolScriptTxHash, poolScriptTxIdx, poolStakeAssetName, testAssetName, testUnit, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet1VK, wallet2 } from "../setup.js"
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
    1, // batcher index
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

const poolAssetAmount = poolUtxo.output.amount.find(amt => amt.unit === testUnit)?.quantity;
const updatedPoolAssetAmount = Number(poolAssetAmount ?? "0") + mintAmount;

const poolPlutusData = poolUtxo.output.plutusData;
if (!poolPlutusData) throw new Error('No plutus data');
const poolDatum = deserializeDatum<PoolDatumType>(poolPlutusData);
const updatedTotalStMinted = Number(poolDatum.fields[1].int) + mintAmount;
const updatedTotalUnderlying = Number(poolDatum.fields[2].int) + mintAmount;

console.log("updatedPoolAssetAmount:", updatedPoolAssetAmount);
console.log("orderLovelaceAmount:", orderLovelaceAmount);
console.log("mintAmount:", mintAmount);
console.log("mintAmount str:", String(mintAmount));
console.log("updatedTotalStMinted:", updatedTotalStMinted);
console.log("updatedTotalUnderlying:", updatedTotalUnderlying);

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
  mConStr1([]),
]);

if (!multiSigCbor) throw new Error('Multisig cbor undefined!');

const unsignedTx = await txBuilder
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
    .spendingTxInReference(poolScriptTxHash, poolScriptTxIdx, undefined, PoolValidatorHash)
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue(mConStr0([]))
    // withdraw zero (pool batching)
    .withdrawalPlutusScriptV3()
    .withdrawal(BatchingRewardAddress, "0")
    .withdrawalTxInReference(batchingScriptTxHash, batchingScriptTxIdx, undefined, BatchingHash)
    .withdrawalRedeemerValue(BatchingRedeemer)
    // mint stake tokens
    .mintPlutusScriptV3()
    .mint(String(mintAmount), MintingHash, poolStakeAssetName)
    .mintingScript(MintingValidatorScript)
    .mintRedeemerValue(mintAmount > 0 ? mConStr0([]) : mConStr1([]))
    // tx out (user order output)
    .txOut(orderReceiverAddr, mintAmount > 0 ? [
        { unit: "lovelace", quantity: orderLovelaceAmount },
        { unit: MintingHash + poolStakeAssetName, quantity: String(mintAmount) },
    ] : [
        { unit: "lovelace", quantity: orderLovelaceAmount },
        { unit: testUnit, quantity: String(-1 * mintAmount) },
    ])
    // pool output
    .txOut(PoolValidatorAddr, updatedPoolAssetAmount > 0 ? [
        { unit: "lovelace", quantity: String(MinPoolLovelace) },
        { unit: PoolValidatorHash + LavaPoolNftName, quantity: "1" },
        { unit: testUnit, quantity: String(updatedPoolAssetAmount) }
    ] : [
        { unit: "lovelace", quantity: String(MinPoolLovelace) },
        { unit: PoolValidatorHash + LavaPoolNftName, quantity: "1" },
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
    .requiredSignerHash(wallet1VK)
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .setFee("3766409")
    .complete()

const signedTx = await wallet1.signTx(unsignedTx);

const txHash = await wallet1.submitTx(signedTx);
console.log("batching tx hash:", txHash);
