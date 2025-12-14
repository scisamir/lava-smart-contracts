import { mConStr0 } from "@meshsdk/core";
import { blockchainProvider, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet1VK } from "../setup.js"
import { OrderValidatorAddr, OrderValidatorRewardAddress, OrderValidatorScript } from "./validator.js";

const orderUtxos = await blockchainProvider.fetchAddressUTxOs(OrderValidatorAddr);
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
    .txOut(wallet1Address, orderUtxo.output.amount)
    .txInCollateral(
        wallet1Collateral.input.txHash,
        wallet1Collateral.input.outputIndex,
    )
    .setTotalCollateral("5000000")
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .requiredSignerHash(wallet1VK)
    .complete()

const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);

console.log("Cancel order tx hash:", txHash);
