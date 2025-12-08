import { deserializeAddress, deserializeDatum, IWallet, mConStr0, mConStr1, MeshTxBuilder, MeshWallet, serializeAddressObj, UTxO } from "@meshsdk/core";
import { setupE2e } from "../setup"
import { OrderValidatorAddr, OrderValidatorRewardAddress, OrderValidatorScript } from "../order/validator";
import { PoolValidatorAddr, PoolValidatorHash } from "../pool/validator";
import { BatchingHash, BatchingRewardAddress } from "./validator";
import { GlobalSettingsAddr } from "../global_settings/validator";
import { BlockchainProviderType, OrderDatumType, PoolDatumType } from "../types";
import { MintingHash, MintingValidatorScript } from "../mint/validator";

export const batchingTx = async (
    blockchainProvider: BlockchainProviderType,
    txBuilder: MeshTxBuilder,
) => {
    const walletPassphrase = process.env.NEXT_PUBLIC_WALLET_PASSPHRASE_ONE;
    if (!walletPassphrase) {
        throw new Error("WALLET_PASSPHRASE_ONE does not exist");
    }
    const wallet = new MeshWallet({
        networkId: 0,
        fetcher: blockchainProvider,
        submitter: blockchainProvider,
        key: {
            type: "mnemonic",
            words: walletPassphrase.split(' ')
        },
    });

    const walletAddress = await wallet.getChangeAddress();

    const walletUtxos = await wallet.getUtxos();

    const walletCollateral = walletUtxos.filter(utxo => Number(utxo.output.amount[0].quantity) >= 8000000)[0];
    if (!walletCollateral) {
        throw new Error('No collateral utxo found');
    }

    const { pubKeyHash: walletVK } = deserializeAddress(walletAddress);

    const { alwaysSuccessMintValidatorHash, testUnit, batchingScriptTxHash, batchingScriptTxIdx, LavaPoolNftName, MinPoolLovelace, multiSigCbor, poolScriptTxHash, poolScriptTxIdx, poolStakeAssetName, testAssetName } = setupE2e();

    const orderUtxos = await blockchainProvider.fetchAddressUTxOs(OrderValidatorAddr);
    const poolUtxo = (await blockchainProvider.fetchAddressUTxOs(PoolValidatorAddr))[0];
    if (orderUtxos.length === 0) {
        throw new Error('No orders to batch');
    }

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

        totalMintAmount += mintAmount;

        return mintAmtDatum > 0
    })
    const noOfUtxosToBatch = 10;
    const batchingOrderUtxos = filteredOrderUtxos.slice(0, noOfUtxosToBatch);

    let orderInputs = txBuilder

    const rMem = 150000;
    const rSteps = 100000000;
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
            .spendingReferenceTxInRedeemerValue("", "Mesh", { mem: rMem, steps: rSteps })
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

    const poolAssetAmount = poolUtxo.output.amount.find(amt => amt.unit === testUnit)?.quantity;
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

    const unsignedTx1 = orderInputs
        // withdraw zero (order)
        .withdrawalPlutusScriptV3()
        .withdrawal(OrderValidatorRewardAddress, "0")
        .withdrawalScript(OrderValidatorScript)
        .withdrawalRedeemerValue(mConStr1([]), "Mesh", { mem: rMem, steps: rSteps })
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
        .spendingReferenceTxInRedeemerValue(mConStr0([]), "Mesh", { mem: rMem, steps: rSteps })
        // withdraw zero (pool batching)
        .withdrawalPlutusScriptV3()
        .withdrawal(BatchingRewardAddress, "0")
        .withdrawalTxInReference(batchingScriptTxHash, batchingScriptTxIdx, undefined, BatchingHash)
        .withdrawalRedeemerValue(BatchingRedeemer, "Mesh", { mem: rMem, steps: rSteps })

    const mintTx = unsignedTx1

    if (totalMintAmount !== 0) {
        mintTx
            // mint stake tokens
            .mintPlutusScriptV3()
            .mint(String(totalMintAmount), MintingHash, poolStakeAssetName)
            .mintingScript(MintingValidatorScript)
            .mintRedeemerValue("", "Mesh", { mem: rMem, steps: rSteps })
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
                { unit: MintingHash + poolStakeAssetName, quantity: String(mintAmount) },
            ] : [
                { unit: "lovelace", quantity: orderLovelaceAmount },
                { unit: testUnit, quantity: String(-1 * mintAmount) },
            ])
    }

    const unsignedTx = await unsignedTx1
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
            walletCollateral.input.txHash,
            walletCollateral.input.outputIndex,
        )
        .setTotalCollateral("6500000")
        .requiredSignerHash(walletVK)
        .changeAddress(walletAddress)
        .selectUtxosFrom(walletUtxos)
        .setFee(String(3766409 + (500000 * batchingOrderUtxos.length)))
        .complete()

    const signedTx = await wallet.signTx(unsignedTx, true);

    const txHash = await wallet.submitTx(signedTx);

    return txHash;
}
