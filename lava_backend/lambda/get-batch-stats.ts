import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MaestroProvider, deserializeDatum, stringToHex } from '@meshsdk/core';
import { OrderValidatorAddr } from './e2e/order/validator';
import { setupE2e } from './e2e/setup';
import { MintingHash } from './e2e/mint/validator';
import { OrderDatumType } from './e2e/types';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const maestro = new MaestroProvider({
      network: 'Preprod',
      apiKey: process.env.MAESTRO_API_KEY!,
    });

    const orderUtxos = await maestro.fetchAddressUTxOs(OrderValidatorAddr);
    const { alwaysSuccessMintValidatorHash } = setupE2e();

    const totalOrders = { test: 0, tStrike: 0, tPulse: 0 };

    orderUtxos.forEach((utxo) => {
      const orderPlutusData = utxo.output.plutusData;
      if (!orderPlutusData) return;

      const orderDatum = deserializeDatum<OrderDatumType>(orderPlutusData);
      const mintAmtDatum = Number(orderDatum.fields[0].fields[0].int);
      if (mintAmtDatum <= 0) return;

      const utxoAmount = utxo.output.amount;
      for (let i = 0; i < utxoAmount.length; i++) {
        const utxoAsset = utxoAmount[i];

        if (
          utxoAsset.unit ===
            alwaysSuccessMintValidatorHash + stringToHex('test') ||
          utxoAsset.unit === MintingHash + stringToHex('stTest')
        ) {
          totalOrders.test += 1;
          break;
        }

        if (
          utxoAsset.unit ===
            alwaysSuccessMintValidatorHash + stringToHex('tStrike') ||
          utxoAsset.unit === MintingHash + stringToHex('LStrike')
        ) {
          totalOrders.tStrike += 1;
          break;
        }

        if (
          utxoAsset.unit ===
            alwaysSuccessMintValidatorHash + stringToHex('tPulse') ||
          utxoAsset.unit === MintingHash + stringToHex('LPulse')
        ) {
          totalOrders.tPulse += 1;
          break;
        }
      }
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
      },
      body: JSON.stringify({ totalOrders }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};