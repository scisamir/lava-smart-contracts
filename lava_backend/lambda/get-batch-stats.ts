import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MaestroProvider, deserializeDatum } from '@meshsdk/core';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { OrderValidatorAddr } from './e2e/order/validator';
import { OrderDatumType } from './e2e/types';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

type VaultSnapshotItem = {
  poolStakeAssetNameHex?: string;
  tokenPair?: {
    base?: string;
    derivative?: string;
  };
};

type BatchStatsPayload = {
  totalOrders: { test: number; tStrike: number; tPulse: number; atrium: number };
  totalOrdersByPool: Record<string, number>;
  pools: Array<{
    poolStakeAssetNameHex: string;
    baseSymbol: string;
    derivativeSymbol: string;
    totalOrders: number;
  }>;
};

const loadSnapshotLabels = async (tableName: string) => {
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

  const labelsByPool = new Map<string, { baseSymbol: string; derivativeSymbol: string }>();
  snapshots.forEach((snapshot) => {
    const poolKey = String(snapshot.poolStakeAssetNameHex ?? '').trim();
    if (!poolKey) {
      return;
    }

    labelsByPool.set(poolKey, {
      baseSymbol: String(snapshot.tokenPair?.base ?? '').trim(),
      derivativeSymbol: String(snapshot.tokenPair?.derivative ?? '').trim(),
    });
  });

  return labelsByPool;
};

const BATCH_STATS_CACHE_TTL_MS = 60_000;
let batchStatsCache:
  | {
      expiresAt: number;
      payload: BatchStatsPayload;
    }
  | null = null;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const now = Date.now();
    if (batchStatsCache && batchStatsCache.expiresAt > now) {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET',
          'Cache-Control': 'public, max-age=30',
        },
        body: JSON.stringify(batchStatsCache.payload),
      };
    }

    const tableName = process.env.TABLE_NAME;
    if (!tableName) {
      throw new Error('TABLE_NAME is missing');
    }

    const maestro = new MaestroProvider({
      network: 'Mainnet',
      apiKey: process.env.MAESTRO_API_KEY!,
    });

    const orderUtxos = await maestro.fetchAddressUTxOs(OrderValidatorAddr);
    const labelsByPool = await loadSnapshotLabels(tableName);
    const totalOrdersByPool = new Map<string, number>();

    orderUtxos.forEach((utxo) => {
      const orderPlutusData = utxo.output.plutusData;
      if (!orderPlutusData) return;

      const orderDatum = deserializeDatum<OrderDatumType>(orderPlutusData);
      const poolSAN = String(orderDatum.fields[3].bytes ?? '').trim();
      if (!poolSAN) {
        return;
      }

      totalOrdersByPool.set(poolSAN, (totalOrdersByPool.get(poolSAN) ?? 0) + 1);
    });

    const pools = Array.from(totalOrdersByPool.entries())
      .map(([poolStakeAssetNameHex, totalOrders]) => {
        const labels = labelsByPool.get(poolStakeAssetNameHex);

        return {
          poolStakeAssetNameHex,
          baseSymbol: labels?.baseSymbol ?? '',
          derivativeSymbol: labels?.derivativeSymbol ?? '',
          totalOrders,
        };
      })
      .sort((a, b) => {
        const left = a.derivativeSymbol || a.poolStakeAssetNameHex;
        const right = b.derivativeSymbol || b.poolStakeAssetNameHex;
        return left.localeCompare(right);
      });

    const totalOrdersLegacy = { test: 0, tStrike: 0, tPulse: 0, atrium: 0 };
    pools.forEach((pool) => {
      const derivativeLower = pool.derivativeSymbol.toLowerCase();
      const baseLower = pool.baseSymbol.toLowerCase();

      if (derivativeLower === 'sttest' || baseLower === 'test') {
        totalOrdersLegacy.test += pool.totalOrders;
      } else if (derivativeLower === 'lstrike' || baseLower === 'tstrike') {
        totalOrdersLegacy.tStrike += pool.totalOrders;
      } else if (derivativeLower === 'lpulse' || baseLower === 'tpulse') {
        totalOrdersLegacy.tPulse += pool.totalOrders;
      } else if (derivativeLower === 'lada' || baseLower === 'ada') {
        totalOrdersLegacy.atrium += pool.totalOrders;
      }
    });

    const payload: BatchStatsPayload = {
      totalOrders: totalOrdersLegacy,
      totalOrdersByPool: Object.fromEntries(totalOrdersByPool.entries()),
      pools,
    };

    batchStatsCache = {
      expiresAt: now + BATCH_STATS_CACHE_TTL_MS,
      payload,
    };

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
        'Cache-Control': 'public, max-age=30',
      },
      body: JSON.stringify(payload),
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