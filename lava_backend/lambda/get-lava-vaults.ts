import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { jsonResponse, verifyOriginRequest } from './security';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

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
  exchangeRate?: number;
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
  onchain?: {
    totalUnderlyingRaw?: string;
    totalStAssetsMintedRaw?: string;
    exchangeRate?: number;
    txHash?: string;
    outputIndex?: number;
  };
  updatedAt?: string;
};

let priceCache: { price: number; change24h: number; expiresAt: number } | null = null;

const getAdaPrice = async (): Promise<{ price: number; change24h: number }> => {
  const now = Date.now();
  if (priceCache && priceCache.expiresAt > now) {
    return { price: priceCache.price, change24h: priceCache.change24h };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=cardano&vs_currencies=usd&include_24hr_change=true',
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = (await res.json()) as any;
      const price = Number(data?.cardano?.usd);
      const change24h = Number(data?.cardano?.usd_24h_change ?? 0);
      if (!Number.isNaN(price) && price > 0) {
        priceCache = {
          price,
          change24h,
          expiresAt: now + 60_000,
        };
        return { price, change24h };
      }
    }
  } catch (err) {
    console.warn('[get-lava-vaults] Failed to fetch ADA price from CoinGecko, using fallback:', err);
  }

  const fallbackPrice = priceCache?.price ?? 0.35;
  const fallbackChange = priceCache?.change24h ?? 0;
  return { price: fallbackPrice, change24h: fallbackChange };
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const auth = await verifyOriginRequest(event);
  if (!auth.ok) {
    return auth.response;
  }

  try {
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

    let totalTvlAda = 0;

    const vaults = ((scanResult.Items ?? []) as VaultSnapshotItem[])
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => {
        const rawUnderlying = Number(
          String(item.onchain?.totalUnderlyingRaw ?? item.staked ?? '0').replace(/,/g, '')
        );
        const rawMinted = Number(
          String(item.onchain?.totalStAssetsMintedRaw ?? item.stStake ?? '0').replace(/,/g, '')
        );
        const exchangeRate = Number(
          item.exchangeRate ??
            item.onchain?.exchangeRate ??
            (rawMinted > 0 ? rawUnderlying / rawMinted : 1.0)
        );

        const baseSymbol = item.tokenPair?.base ?? '';
        if (baseSymbol.toUpperCase() === 'ADA' || baseSymbol === '') {
          totalTvlAda += rawUnderlying / 1_000_000;
        }

        return {
          name: item.name,
          logo: item.logo ?? '',
          score: item.score ?? '0',
          status: item.status ?? 'Closed',
          recentBlocks: Number(item.recentBlocks ?? 0),
          stStake: item.stStake ?? '0',
          staked: item.staked ?? '0',
          exchangeRate: Number.isFinite(exchangeRate) && exchangeRate > 0 ? exchangeRate : 1.0,
          tokenPair: {
            base: baseSymbol,
            derivative: item.tokenPair?.derivative ?? item.name,
          },
          tokenDetails: item.tokenDetails ?? null,
          poolStakeAssetNameHex:
            item.poolStakeAssetNameHex ??
            item.tokenDetails?.derivative?.assetNameHex ??
            '',
          updatedAt: item.updatedAt ?? null,
        };
      });

    const { price: adaPriceUsd, change24h: ada24hChange } = await getAdaPrice();

    let protocolStatsItem: any = null;
    try {
      const statsRes = await ddb.send(
        new GetCommand({
          TableName: tableName,
          Key: { pk: 'PROTOCOL#STATS', sk: 'LATEST' },
        })
      );
      protocolStatsItem = statsRes.Item;
    } catch {
      // ignore
    }

    const tvlAda = totalTvlAda > 0 ? totalTvlAda : Number(protocolStatsItem?.tvlAda ?? 0);
    const tvlUsd = tvlAda * adaPriceUsd;
    const holders = Number(protocolStatsItem?.holders ?? 1);
    const stakingApy = String(protocolStatsItem?.stakingApy ?? '3.65%');

    const stats = {
      tvlAda,
      tvlUsd,
      stakingApy,
      holders,
      adaPriceUsd,
      ada24hChange,
    };

    return jsonResponse(200, { vaults, stats }, auth.origin);
  } catch (error) {
    console.error(error);

    return jsonResponse(500, { error: 'Internal server error' }, auth.origin);
  }
};
