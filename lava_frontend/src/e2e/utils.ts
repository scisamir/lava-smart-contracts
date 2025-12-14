import { deserializeDatum, serializeAddressObj, stringToHex, tokenName } from "@meshsdk/core";
import { BlockchainProviderType, OrderDatumType } from "./types";
import { OrderValidatorAddr } from "./order/validator";
import { TOKEN_PAIRS, UserOrderType } from "@/lib/types";
import { setupE2e } from "./setup";
import { MintingHash } from "./mint/validator";

const fetchUserOrders = async (blockchainProvider: BlockchainProviderType, address: string) => {
  const { alwaysSuccessMintValidatorHash } = setupE2e();

  const orderUtxos = await blockchainProvider.fetchAddressUTxOs(OrderValidatorAddr);
  console.log("orderUtxos:", orderUtxos);

  const userOrders: UserOrderType[] = [];

  orderUtxos.filter(utxo => {
    const orderPlutusData = utxo.output.plutusData;
    if (!orderPlutusData) throw new Error('No plutus data');
    const orderDatum = deserializeDatum<OrderDatumType>(orderPlutusData);

    const orderReceiverAddr = serializeAddressObj(orderDatum.fields[1]);

    let isOptIn = false;
    if (Number(orderDatum.fields[0].constructor) === 0) {
        isOptIn = true;
    }

    let tokenName = "";
    const utxoAmount = utxo.output.amount;
    for (let i = 0; i < utxoAmount.length; i++) {
        const utxoAsset = utxoAmount[i];
        if (utxoAsset.unit === (alwaysSuccessMintValidatorHash + stringToHex(TOKEN_PAIRS[0].base))) {
          tokenName = TOKEN_PAIRS[0].base;
        } else if (utxoAsset.unit === (MintingHash + stringToHex(TOKEN_PAIRS[0].derivative))) {
          tokenName = TOKEN_PAIRS[0].derivative;
        } else if (utxoAsset.unit === (alwaysSuccessMintValidatorHash + stringToHex(TOKEN_PAIRS[1].base))) {
          tokenName = TOKEN_PAIRS[1].base;
        } else if (utxoAsset.unit === (MintingHash + stringToHex(TOKEN_PAIRS[1].derivative))) {
          tokenName = TOKEN_PAIRS[1].derivative;
        } else if (utxoAsset.unit === (alwaysSuccessMintValidatorHash + stringToHex(TOKEN_PAIRS[2].base))) {
          tokenName = TOKEN_PAIRS[2].base
        } else if (utxoAsset.unit === (MintingHash + stringToHex(TOKEN_PAIRS[2].derivative))) {
          tokenName = TOKEN_PAIRS[2].derivative
        }
    }

    if (address === orderReceiverAddr) {
      const newOrder: UserOrderType = {
        amount: Number(orderDatum.fields[0].fields[0].int),
        txHash: utxo.input.txHash,
        isOptIn,
        tokenName,
      };
      userOrders.push(newOrder);

      return true;
    }

    return false;
  });

  console.log("userOrders:", userOrders);

  return userOrders;
}

const getTotalOrderNumbers = async (blockchainProvider: BlockchainProviderType,) => {
  const orderUtxos = await blockchainProvider.fetchAddressUTxOs(OrderValidatorAddr);
  const { alwaysSuccessMintValidatorHash } = setupE2e();

  let totalOrders = { "test": 0, "tStrike": 0, "tPulse": 0 };

  orderUtxos.filter(utxo => {
    const orderPlutusData = utxo.output.plutusData;
    if (!orderPlutusData) throw new Error('No plutus data');
    const orderDatum = deserializeDatum<OrderDatumType>(orderPlutusData);

    let isOptIn = false;
    if (Number(orderDatum.fields[0].constructor) === 0) {
        isOptIn = true;
    }
    const mintAmtDatum = Number(orderDatum.fields[0].fields[0].int);

    const utxoAmount = utxo.output.amount;
    for (let i = 0; i < utxoAmount.length; i++) {
        const utxoAsset = utxoAmount[i];
        if (utxoAsset.unit === (alwaysSuccessMintValidatorHash + stringToHex(TOKEN_PAIRS[0].base)) || utxoAsset.unit === (MintingHash + stringToHex(TOKEN_PAIRS[0].derivative))) {
            totalOrders.test = totalOrders.test + 1;
        } else if (utxoAsset.unit === (alwaysSuccessMintValidatorHash + stringToHex(TOKEN_PAIRS[1].base)) || utxoAsset.unit === (MintingHash + stringToHex(TOKEN_PAIRS[1].derivative))) {
          totalOrders.tStrike = totalOrders.tStrike + 1;
        } else if (utxoAsset.unit === (alwaysSuccessMintValidatorHash + stringToHex(TOKEN_PAIRS[2].base)) || utxoAsset.unit === (MintingHash + stringToHex(TOKEN_PAIRS[2].derivative))) {
          totalOrders.tPulse = totalOrders.tPulse + 1;
        }
    }

    return mintAmtDatum > 0;
  })

  return totalOrders;
}

export {
  fetchUserOrders,
  getTotalOrderNumbers,
}
