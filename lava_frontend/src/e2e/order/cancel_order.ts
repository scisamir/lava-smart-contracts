import { IWallet, mConStr0, MeshTxBuilder, UTxO } from "@meshsdk/core";
import { OrderValidatorAddr, OrderValidatorRewardAddress, OrderValidatorScript } from "./validator";
import { BlockchainProviderType } from "../types";

export const cancelOrder = async (
    blockchainProvider: BlockchainProviderType,
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletAddress: string,
    walletCollateral: UTxO,
    walletUtxos: UTxO[],
    walletVK: string,
    orderTxHash: string,
) => {
    const orderUtxos = await blockchainProvider.fetchUTxOs(orderTxHash, 0);
    console.log(orderUtxos);
    const orderUtxo = orderUtxos[0];
    if (!orderUtxo) {
        throw new Error("order utxo not found!");
    }

    const unsignedTx = await txBuilder
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
        // withdraw zero
        .withdrawalPlutusScriptV3()
        .withdrawal(OrderValidatorRewardAddress, "0")
        .withdrawalScript(OrderValidatorScript)
        .withdrawalRedeemerValue(mConStr0([]))
        // tx out
        .txOut(walletAddress, orderUtxo.output.amount)
        .txInCollateral(
            walletCollateral.input.txHash,
            walletCollateral.input.outputIndex,
            walletCollateral.output.amount,
            walletCollateral.output.address,
        )
        .changeAddress(walletAddress)
        .selectUtxosFrom(walletUtxos)
        .requiredSignerHash(walletVK)
        .complete()

    const signedTx = await wallet.signTx(unsignedTx, true);
    const txHash = await wallet.submitTx(signedTx);

    return txHash;
}
