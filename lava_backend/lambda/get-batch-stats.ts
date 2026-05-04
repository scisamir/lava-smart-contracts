import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MaestroProvider, deserializeDatum } from '@meshsdk/core';
import { OrderValidatorAddr } from './e2e/order/validator';
import { setupE2e } from './e2e/setup';
import { OrderDatumType } from './e2e/types';
import { jsonResponse, verifyOriginRequest } from './security';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const originCheck = await verifyOriginRequest(event);
  if (!originCheck.ok) {
    return originCheck.response;
  }

  try {
    const maestro = new MaestroProvider({
      network: 'Mainnet',
      apiKey: process.env.MAESTRO_API_KEY!,
    });

    const orderUtxos = await maestro.fetchAddressUTxOs(OrderValidatorAddr);
    const {
      poolStakeAssetName,
      tStrikePoolStakeAssetName,
      tPulsePoolStakeAssetName,
      ATRIUM_POOL_STAKE_ASSET_NAME,
    } = setupE2e();

    const totalOrders = { test: 0, tStrike: 0, tPulse: 0, atrium: 0 };

    orderUtxos.forEach((utxo) => {
      const orderPlutusData = utxo.output.plutusData;
      if (!orderPlutusData) return;

      const orderDatum = deserializeDatum<OrderDatumType>(orderPlutusData);
      const poolSAN = orderDatum.fields[3].bytes;

      if (poolSAN === poolStakeAssetName) {
        totalOrders.test += 1;
      } else if (poolSAN === tStrikePoolStakeAssetName) {
        totalOrders.tStrike += 1;
      } else if (poolSAN === tPulsePoolStakeAssetName) {
        totalOrders.tPulse += 1;
      } else if (poolSAN === ATRIUM_POOL_STAKE_ASSET_NAME) {
        totalOrders.atrium += 1;
      }
    });

    return jsonResponse(200, { totalOrders }, originCheck.origin);
  } catch (error) {
    console.error(error);
    return jsonResponse(500, { error: 'Internal server error' }, originCheck.origin);
  }
};