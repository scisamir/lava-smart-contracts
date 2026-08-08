import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  deserializeDatum,
  serializeAddressObj,
} from '@meshsdk/core';
import { MaestroProvider } from '@meshsdk/core';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { setupE2e } from './e2e/setup';
import { OrderDatumType } from './e2e/types';
import { OrderValidatorAddr } from './e2e/order/validator';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

type VaultSnapshotItem = {
  entityType?: string;
  poolStakeAssetNameHex?: string;
  tokenPair?: {
    base?: string;
    derivative?: string;
  };
};

const resolveTokenLabelsByPoolSan = async (
  tableName: string
): Promise<Map<string, { base: string; derivative: string }>> => {
  const scanResult = await ddb.send(
    new ScanCommand({
      TableName: tableName,
      FilterExpression: '#entityType = :entityType',
      ExpressionAttributeNames: {
        '#entityType': 'entityType',
      },
      ExpressionAttributeValues: {
        ':entityType': 'VAULT_SNAPSHOT',
      },
    })
  );

  const snapshots = (scanResult.Items ?? []) as VaultSnapshotItem[];
  const labelsByPoolSan = new Map<string, { base: string; derivative: string }>();

  snapshots.forEach((snapshot) => {
    const poolSan = String(snapshot.poolStakeAssetNameHex ?? '').trim();
    if (!poolSan) {
      return;
    }

    const base = String(snapshot.tokenPair?.base ?? '').trim();
    const derivative = String(snapshot.tokenPair?.derivative ?? '').trim();

    labelsByPoolSan.set(poolSan, {
      base,
      derivative,
    });
  });

  return labelsByPoolSan;
};

type UserOrder = {
  amount: number;
  txHash: string;
  outputIndex: number;
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
    const tableName = process.env.TABLE_NAME;
    if (!maestroKey) {
      throw new Error('MAESTRO_API_KEY is missing');
    }
    if (!tableName) {
      throw new Error('TABLE_NAME is missing');
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
    const tokenLabelsByPoolSan = await resolveTokenLabelsByPoolSan(tableName);

    const fallbackTokenLabelsByPoolSan = new Map<string, { base: string; derivative: string }>([
      [poolStakeAssetName, { base: 'test', derivative: 'stTest' }],
      [tStrikePoolStakeAssetName, { base: 'tStrike', derivative: 'LStrike' }],
      [tPulsePoolStakeAssetName, { base: 'tPulse', derivative: 'LPulse' }],
      [ATRIUM_POOL_STAKE_ASSET_NAME, { base: 'ADA', derivative: 'LADA' }],
    ]);

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
      const tokenLabels =
        tokenLabelsByPoolSan.get(poolSAN) ?? fallbackTokenLabelsByPoolSan.get(poolSAN);
      const tokenName = isOptIn
        ? tokenLabels?.base || poolSAN
        : tokenLabels?.derivative || poolSAN;

      userOrders.push({
        amount: Number(orderDatum.fields[0].fields[0].int),
        txHash: utxo.input.txHash,
        outputIndex: Number(utxo.input.outputIndex),
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
