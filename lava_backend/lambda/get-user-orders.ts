import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  deserializeDatum,
  serializeAddressObj,
  stringToHex,
} from '@meshsdk/core';
import { MaestroProvider } from '@meshsdk/core';
import { setupE2e } from './e2e/setup';
import { OrderDatumType } from './e2e/types';
import { OrderValidatorAddr } from './e2e/order/validator';
import { MintingHash } from './e2e/mint/validator';

const TOKEN_PAIRS = [
  { base: 'test', derivative: 'stTest' },
  { base: 'tStrike', derivative: 'LStrike' },
  { base: 'tPulse', derivative: 'LPulse' },
];

type UserOrder = {
  amount: number;
  txHash: string;
  isOptIn: boolean;
  tokenName: string;
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const address = event.queryStringParameters?.address;

    if (!address) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET,OPTIONS',
        },
        body: JSON.stringify({ error: 'Missing required query param: address' }),
      };
    }

    const maestroKey = process.env.MAESTRO_API_KEY;
    if (!maestroKey) {
      throw new Error('MAESTRO_API_KEY is missing');
    }

    const provider = new MaestroProvider({
      network: 'Preprod',
      apiKey: maestroKey,
    });

    const { alwaysSuccessMintValidatorHash } = setupE2e();
    const orderUtxos = await provider.fetchAddressUTxOs(OrderValidatorAddr);

    const userOrders: UserOrder[] = [];

    orderUtxos.forEach((utxo) => {
      const orderPlutusData = utxo.output.plutusData;
      if (!orderPlutusData) {
        return;
      }

      const orderDatum = deserializeDatum<OrderDatumType>(orderPlutusData);
      const orderReceiverAddr = serializeAddressObj(orderDatum.fields[1]);

      if (orderReceiverAddr !== address) {
        return;
      }

      const isOptIn = Number(orderDatum.fields[0].constructor) === 0;

      let tokenName = '';
      const utxoAmount = utxo.output.amount;

      for (let i = 0; i < utxoAmount.length; i++) {
        const utxoAsset = utxoAmount[i];

        if (
          utxoAsset.unit ===
          alwaysSuccessMintValidatorHash + stringToHex(TOKEN_PAIRS[0].base)
        ) {
          tokenName = TOKEN_PAIRS[0].base;
        } else if (
          utxoAsset.unit === MintingHash + stringToHex(TOKEN_PAIRS[0].derivative)
        ) {
          tokenName = TOKEN_PAIRS[0].derivative;
        } else if (
          utxoAsset.unit ===
          alwaysSuccessMintValidatorHash + stringToHex(TOKEN_PAIRS[1].base)
        ) {
          tokenName = TOKEN_PAIRS[1].base;
        } else if (
          utxoAsset.unit === MintingHash + stringToHex(TOKEN_PAIRS[1].derivative)
        ) {
          tokenName = TOKEN_PAIRS[1].derivative;
        } else if (
          utxoAsset.unit ===
          alwaysSuccessMintValidatorHash + stringToHex(TOKEN_PAIRS[2].base)
        ) {
          tokenName = TOKEN_PAIRS[2].base;
        } else if (
          utxoAsset.unit === MintingHash + stringToHex(TOKEN_PAIRS[2].derivative)
        ) {
          tokenName = TOKEN_PAIRS[2].derivative;
        }
      }

      userOrders.push({
        amount: Number(orderDatum.fields[0].fields[0].int),
        txHash: utxo.input.txHash,
        isOptIn,
        tokenName,
      });
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
      },
      body: JSON.stringify({ orders: userOrders }),
    };
  } catch (error) {
    console.error('Get user orders error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
      },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
    };
  }
};
