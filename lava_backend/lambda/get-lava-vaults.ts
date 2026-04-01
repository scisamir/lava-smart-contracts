import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { setupE2e } from './e2e/setup';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

type VaultSnapshotItem = {
  pk: string;
  sk: string;
  entityType: 'VAULT_SNAPSHOT';
  name: string;
  logo?: string;
  score?: string;
  status?: string;
  recentBlocks?: number;
  stStake?: string;
  staked?: string;
  tokenPair?: {
    base?: string;
    derivative?: string;
  };
  tokenDetails?: {
    derivative?: {
      symbol?: string;
      displayName?: string;
      policyId?: string;
      assetNameHex?: string;
      decimals?: number;
      logo?: string;
    };
    base?: {
      symbol?: string;
      displayName?: string;
      policyId?: string;
      assetNameHex?: string;
      decimals?: number;
      logo?: string;
    };
  };
  poolStakeAssetNameHex?: string;
  updatedAt?: string;
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { ATRIUM_POOL_STAKE_ASSET_NAME } = setupE2e();

    const tableName = process.env.TABLE_NAME;
    if (!tableName) {
      throw new Error('TABLE_NAME is not configured');
    }

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

    const vaults = ((scanResult.Items ?? []) as VaultSnapshotItem[])
      .filter((item) => {
        const poolStakeAssetNameHex =
          item.poolStakeAssetNameHex ?? item.tokenDetails?.derivative?.assetNameHex ?? '';
        return poolStakeAssetNameHex === ATRIUM_POOL_STAKE_ASSET_NAME;
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({
        name: item.name,
        logo: item.logo ?? '',
        score: item.score ?? '0',
        status: item.status ?? 'Closed',
        recentBlocks: Number(item.recentBlocks ?? 0),
        stStake: item.stStake ?? '0',
        staked: item.staked ?? '0',
        tokenPair: {
          base: item.tokenPair?.base ?? '',
          derivative: item.tokenPair?.derivative ?? item.name,
        },
        tokenDetails: item.tokenDetails ?? null,
        poolStakeAssetNameHex:
          item.poolStakeAssetNameHex ??
          item.tokenDetails?.derivative?.assetNameHex ??
          '',
        updatedAt: item.updatedAt ?? null,
      }));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
      },
      body: JSON.stringify({ vaults }),
    };
  } catch (error) {
    console.error(error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
