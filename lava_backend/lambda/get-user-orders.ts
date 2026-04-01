import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  deserializeDatum,
  serializeAddressObj,
} from '@meshsdk/core';
import { MaestroProvider } from '@meshsdk/core';
import { setupE2e } from './e2e/setup';
import { OrderDatumType } from './e2e/types';
import { OrderValidatorAddr } from './e2e/order/validator';

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
      network: 'Mainnet',
      apiKey: maestroKey,
    });

    const {
      NETWORK_ID,
      poolStakeAssetName,
      tStrikePoolStakeAssetName,
      tPulsePoolStakeAssetName,
      ATRIUM_POOL_STAKE_ASSET_NAME,
    } = setupE2e();
    const orderUtxos = await provider.fetchAddressUTxOs(OrderValidatorAddr);

    const userOrders: UserOrder[] = [];

    orderUtxos.forEach((utxo) => {
      const orderPlutusData = utxo.output.plutusData;
      if (!orderPlutusData) {
        return;
      }

      const orderDatum = deserializeDatum<OrderDatumType>(orderPlutusData);
      const orderReceiverAddr = serializeAddressObj(orderDatum.fields[1], NETWORK_ID as 0 | 1);

      if (orderReceiverAddr !== address) {
        return;
      }

      const isOptIn = Number(orderDatum.fields[0].constructor) === 0;

      const poolSAN = orderDatum.fields[3].bytes;
      let tokenName = '';
      if (poolSAN === poolStakeAssetName) {
        tokenName = isOptIn ? 'test' : 'stTest';
      } else if (poolSAN === tStrikePoolStakeAssetName) {
        tokenName = isOptIn ? 'tStrike' : 'LStrike';
      } else if (poolSAN === tPulsePoolStakeAssetName) {
        tokenName = isOptIn ? 'tPulse' : 'LPulse';
      } else if (poolSAN === ATRIUM_POOL_STAKE_ASSET_NAME) {
        tokenName = isOptIn ? 'ADA' : 'LADA';
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
