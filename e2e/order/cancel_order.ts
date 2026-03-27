import {
  deserializeDatum,
  mConStr0,
  mConStr1,
  serializeAddressObj,
} from "@meshsdk/core";
import {
  blockchainProvider,
  txBuilder,
  wallet1,
  wallet1Address,
  wallet1Utxos,
  wallet1VK,
  requireWallet1Collateral,
  NETWORK_ID,
} from "../setup.js";
import { OrderDatumType } from "../types.js";
import {
  OrderValidatorAddr,
  OrderValidatorHash,
  OrderValidatorScript,
} from "./validator.js";

const wallet1Collateral = requireWallet1Collateral();

const orderUtxos =
  await blockchainProvider.fetchAddressUTxOs(OrderValidatorAddr);
const orderUtxo = [...orderUtxos].reverse().find((utxo) => {
  const orderPlutusData = utxo.output.plutusData;
  if (!orderPlutusData) {
    return false;
  }

  const orderData = deserializeDatum<OrderDatumType>(orderPlutusData);
  return (
    serializeAddressObj(orderData.fields[1], NETWORK_ID) === wallet1Address
  );
});
if (!orderUtxo) {
  throw new Error("order utxo not found!");
}

const orderPlutusData = orderUtxo.output.plutusData;
if (!orderPlutusData) {
  throw new Error("order datum not found!");
}
const orderData = deserializeDatum<OrderDatumType>(orderPlutusData);
const receiverAddress = serializeAddressObj(orderData.fields[1], NETWORK_ID);
const receiverAmount = orderUtxo.output.amount.filter(
  (asset) => asset.unit !== OrderValidatorHash,
);

const unsignedTx = await txBuilder
  .spendingPlutusScriptV3()
  .txIn(
    orderUtxo.input.txHash,
    orderUtxo.input.outputIndex,
    orderUtxo.output.amount,
    orderUtxo.output.address,
  )
  .txInScript(OrderValidatorScript)
  .txInInlineDatumPresent()
  .txInRedeemerValue(mConStr0([]))
  .mintPlutusScriptV3()
  .mint("-1", OrderValidatorHash, "")
  .mintingScript(OrderValidatorScript)
  .mintRedeemerValue(mConStr1([]))
  .txOut(receiverAddress, receiverAmount)
  .txInCollateral(
    wallet1Collateral.input.txHash,
    wallet1Collateral.input.outputIndex,
  )
  .setTotalCollateral("5000000")
  .changeAddress(wallet1Address)
  .selectUtxosFrom(wallet1Utxos)
  .requiredSignerHash(wallet1VK)
  .complete();

const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);

console.log("Cancel order tx hash:", txHash);
