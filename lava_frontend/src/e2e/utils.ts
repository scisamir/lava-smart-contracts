import { deserializeDatum, serializeAddressObj } from "@meshsdk/core";
import { BlockchainProviderType, OrderDatumType } from "./types";
import { OrderValidatorAddr } from "./order/validator";
import { UserOrderType } from "@/lib/types";

const fetchUserOrders = async (blockchainProvider: BlockchainProviderType, address: string) => {
  const orderUtxos = await blockchainProvider.fetchAddressUTxOs(OrderValidatorAddr);

  const userOrders: UserOrderType[] = [];

  orderUtxos.filter(utxo => {
    const orderPlutusData = utxo.output.plutusData;
    if (!orderPlutusData) throw new Error('No plutus data');
    const orderDatum = deserializeDatum<OrderDatumType>(orderPlutusData);

    const orderReceiverAddr = serializeAddressObj(orderDatum.fields[1]);

    if (address === orderReceiverAddr) {
      const newOrder: UserOrderType = {
        amount: Number(orderDatum.fields[0].fields[0].int) / 1_000_000,
        txHash: utxo.input.txHash,
      };
      userOrders.push(newOrder);

      return true;
    }

    return false;
  });

  console.log("userOrders:", userOrders);

  return userOrders;
}

export {
  fetchUserOrders,
}
