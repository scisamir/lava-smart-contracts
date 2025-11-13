import { IWallet, mConStr0, MeshTxBuilder, UTxO } from "@meshsdk/core";
import { OrderValidatorAddr, OrderValidatorRewardAddress, OrderValidatorScript } from "./validator.js";
import { BlockchainProviderType } from "../types.js";

const cancelOrder = async (
    blockchainProvider: BlockchainProviderType,
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletAddress: string,
    walletCollateral: UTxO,
    walletUtxos: UTxO[],
    walletVK: string,
) => {
const orderUtxos = await blockchainProvider.fetchAddressUTxOs(OrderValidatorAddr);
console.log(orderUtxos);
const orderUtxo = orderUtxos[orderUtxos.length - 1];
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

const signedTx = await wallet.signTx(unsignedTx);
const txHash = await wallet.submitTx(signedTx);

console.log("Cancel order tx hash:", txHash);
}
