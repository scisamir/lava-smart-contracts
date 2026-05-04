import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  deserializeDatum,
  serializeAddressObj,
} from '@meshsdk/core';
import { MaestroProvider } from '@meshsdk/core';
import { setupE2e } from './e2e/setup';
import { OrderDatumType } from './e2e/types';
import { OrderValidatorAddr } from './e2e/order/validator';
import { jsonResponse, normalizeCardanoAddress, verifyAccessToken } from './security';

type UserOrder = {
  amount: number;
  txHash: string;
  isOptIn: boolean;
  tokenName: string;
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const auth = await verifyAccessToken(event);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const address = auth.address;

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

      if (normalizeCardanoAddress(orderReceiverAddr) !== address) {
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

    return jsonResponse(200, { orders: userOrders }, auth.origin);
  } catch (error) {
    console.error('Get user orders error:', error);
    return jsonResponse(
      500,
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      auth.origin
    );
  }
};
