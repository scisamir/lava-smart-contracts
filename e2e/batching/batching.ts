import { deserializeDatum, mConStr0, mConStr1, serializeAddressObj } from "@meshsdk/core";
import { alwaysSuccessMintValidatorHash, batchingScriptTxHash, batchingScriptTxIdx, blockchainProvider, LavaPoolNftName, MinPoolLovelace, multiSigCbor, poolScriptTxHash, poolScriptTxIdx, poolStakeAssetName, testAssetName, testUnit, tStrikeAssetName, tStrikePoolStakeAssetName, tStrikeUnit, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet1VK } from "../setup.js"
import { OrderValidatorAddr, OrderValidatorRewardAddress, OrderValidatorScript } from "../order/validator.js";
import { PoolValidatorAddr, PoolValidatorHash } from "../pool/validator.js";
import { BatchingHash, BatchingRewardAddress } from "./validator.js";
import { GlobalSettingsAddr } from "../global_settings/validator.js";
import { OrderDatumType, PoolDatumType } from "../types.js";
import { MintingHash, MintingValidatorScript } from "../mint/validator.js";

// Variable data
// ----------------- test ----------------------
// const poolSAN = poolStakeAssetName;
// const orderAssetName = testAssetName;
// const orderOptInUnit = testUnit;
// const orderOptOutUnit = MintingHash + poolSAN;
// ----------------- tStrike ----------------------
const poolSAN = tStrikePoolStakeAssetName;
const orderOptInUnit = tStrikeUnit;
const orderOptOutUnit = MintingHash + poolSAN;
const orderAssetName = tStrikeAssetName;

const orderUtxos = await blockchainProvider.fetchAddressUTxOs(OrderValidatorAddr);
const poolUtxos = await blockchainProvider.fetchAddressUTxOs(PoolValidatorAddr);

const poolUtxo = poolUtxos.find(utxo => {
    const poolPlutusData = utxo.output.plutusData;
    if (!poolPlutusData) throw new Error('No plutus data');
    const poolDatum = deserializeDatum<PoolDatumType>(poolPlutusData);

    const fpoolSAN = poolDatum.fields[6].bytes;

    return (fpoolSAN === poolSAN);
});
if (!poolUtxo) throw new Error('Pool UTxO not found!');

let totalMintAmount = 0;
const filteredOrderUtxos = orderUtxos.filter(utxo => {
    const orderPlutusData = utxo.output.plutusData;
    if (!orderPlutusData) throw new Error('No plutus data');
    const orderDatum = deserializeDatum<OrderDatumType>(orderPlutusData);

    let isOptIn = false;
    if (Number(orderDatum.fields[0].constructor) === 0) {
        isOptIn = true;
    }
    const mintAmtDatum = Number(orderDatum.fields[0].fields[0].int);
    const mintAmount = isOptIn ? mintAmtDatum : -1 * mintAmtDatum;
    console.log("mintAmtDatum:", mintAmtDatum);

    let isRightOrder = false;
    const utxoAmount = utxo.output.amount;
    for (let i = 0; i < utxoAmount.length; i++) {
        const utxoAsset = utxoAmount[i];
        if (utxoAsset.unit === orderOptInUnit || utxoAsset.unit === orderOptOutUnit) {
            isRightOrder = true;
            totalMintAmount += mintAmount;
            break;
        }
    }

    return (mintAmtDatum > 0 && isRightOrder)
})
if (!filteredOrderUtxos) throw new Error('No order UTxOs to batch!');
const noOfUtxosToBatch = 10;
const batchingOrderUtxos = filteredOrderUtxos.slice(0, noOfUtxosToBatch);

let orderInputs = txBuilder

for (let i = 0; i < batchingOrderUtxos.length; i++) {
    const orderUtxo = batchingOrderUtxos[i];

    orderInputs = orderInputs
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
}

const BatchingRedeemer = mConStr0([
    1, // batcher index
    mConStr0([ // batching asset
        mConStr0([]),
        alwaysSuccessMintValidatorHash,
        orderAssetName,
        1_000_000,
  ]),
]);

const gsUtxo = (await blockchainProvider.fetchAddressUTxOs(GlobalSettingsAddr))[0];

const poolAssetAmount = poolUtxo.output.amount.find(amt => amt.unit === orderOptInUnit)?.quantity;
const updatedPoolAssetAmount = Number(poolAssetAmount ?? "0") + totalMintAmount;

const poolPlutusData = poolUtxo.output.plutusData;
if (!poolPlutusData) throw new Error('No plutus data');
const poolDatum = deserializeDatum<PoolDatumType>(poolPlutusData);
const updatedTotalStMinted = Number(poolDatum.fields[1].int) + totalMintAmount;
const updatedTotalUnderlying = Number(poolDatum.fields[2].int) + totalMintAmount;

console.log("updatedPoolAssetAmount:", updatedPoolAssetAmount);
console.log("updatedTotalStMinted:", updatedTotalStMinted);
console.log("updatedTotalUnderlying:", updatedTotalUnderlying);
console.log("totalMintAmount:", totalMintAmount);
console.log("orderUtxos:", orderUtxos);
console.log("filteredOrderUtxos:", filteredOrderUtxos);
console.log("batchingOrderUtxos:", batchingOrderUtxos);

const poolAsset =
  mConStr0([
    mConStr0([]),
    alwaysSuccessMintValidatorHash,
    orderAssetName,
    1_000_000,
  ]);
const upatedPoolDatum = mConStr0([
  mConStr1([BatchingHash]), // pool batching cred
  updatedTotalStMinted, // total_st_assets_minted
  updatedTotalUnderlying, // total_underlying
  poolDatum.fields[3].int, // exchange_rate
  poolDatum.fields[4].int, // total_rewards_accrued
  poolAsset,
  poolSAN,
  mConStr1([]),
]);

if (!multiSigCbor) throw new Error('Multisig cbor undefined!');

const unsignedTx1 = orderInputs
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

const mintTx = unsignedTx1

if (totalMintAmount !== 0) {
    mintTx
        // mint stake tokens
        .mintPlutusScriptV3()
        .mint(String(totalMintAmount), MintingHash, poolSAN)
        .mintingScript(MintingValidatorScript)
        .mintRedeemerValue("")
}

let orderOutputs = mintTx
for (let i = 0; i < batchingOrderUtxos.length; i++) {
    const orderUtxo = batchingOrderUtxos[i];

    const orderLovelace = orderUtxo.output.amount.find(amt => amt.unit === "lovelace");
    const orderLovelaceAmount = orderLovelace!.quantity;

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
    console.log("mintAmount:", mintAmount);

    orderOutputs = orderOutputs
        // tx out (user order output)
        .txOut(orderReceiverAddr, mintAmount > 0 ? [
            { unit: "lovelace", quantity: orderLovelaceAmount },
            { unit: orderOptOutUnit, quantity: String(mintAmount) },
        ] : [
            { unit: "lovelace", quantity: orderLovelaceAmount },
            { unit: orderOptInUnit, quantity: String(-1 * mintAmount) },
        ])
}

const unsignedTx = await unsignedTx1
    // pool output
    .txOut(PoolValidatorAddr, updatedPoolAssetAmount > 0 ? [
        { unit: "lovelace", quantity: String(MinPoolLovelace) },
        { unit: PoolValidatorHash + LavaPoolNftName, quantity: "1" },
        { unit: orderOptInUnit, quantity: String(updatedPoolAssetAmount) }
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
    )
    .setTotalCollateral("10000000")
    .requiredSignerHash(wallet1VK)
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .setFee(String(3766409 + (500000 * batchingOrderUtxos.length)))
    .complete()

console.log("batchingOrderUtxos.length:", batchingOrderUtxos.length);

const signedTx = await wallet1.signTx(unsignedTx);

const txHash = await wallet1.submitTx(signedTx);
console.log("batching tx hash:", txHash);
