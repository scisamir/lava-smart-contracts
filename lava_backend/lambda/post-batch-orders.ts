import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { batchingTx } from './e2e/batching/batching';
import { setupE2e } from './e2e/setup';
import { jsonResponse, parseJsonBody, verifyAccessToken } from './security';
import { createMaestroProvider, createMeshTxBuilder } from './cardano';

const resolvePoolStakeAssetNameHex = (batchTypeOrPoolKey: string): string => {
  const key = batchTypeOrPoolKey.trim();
  if (!key) {
    return '';
  }

  const {
    poolStakeAssetName,
    tStrikePoolStakeAssetName,
    tPulsePoolStakeAssetName,
    ATRIUM_POOL_STAKE_ASSET_NAME,
  } = setupE2e();

  const legacyMap: Record<string, string> = {
    test: poolStakeAssetName,
    tStrike: tStrikePoolStakeAssetName,
    tPulse: tPulsePoolStakeAssetName,
    atrium: ATRIUM_POOL_STAKE_ASSET_NAME,
  };

  return legacyMap[key] ?? key;
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const auth = await verifyAccessToken(event, { requiredScopes: ['lava:batch'] });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = parseJsonBody<Record<string, unknown>>(event) ?? {};
    const batchTypeOrPoolKey = String(
      body?.batchType ?? body?.poolStakeAssetNameHex ?? ''
    ).trim();
    const poolStakeAssetNameHex = resolvePoolStakeAssetNameHex(batchTypeOrPoolKey);

    if (!poolStakeAssetNameHex) {
      return jsonResponse(
        400,
        { error: 'Invalid or missing batchType/poolStakeAssetNameHex' },
        auth.origin
      );
    }

    const maestroKey = process.env.MAESTRO_API_KEY;
    if (!maestroKey) {
      throw new Error('MAESTRO_API_KEY is missing');
    }

    const batcherWalletPassphrase = process.env.BATCHER_WALLET_PASSPHRASE;

    if (!batcherWalletPassphrase) {
      throw new Error('BATCHER_WALLET_PASSPHRASE is missing');
    }

    const blockchainProvider = createMaestroProvider(maestroKey);
    const txBuilder = createMeshTxBuilder(blockchainProvider, true);

    const txHash = await batchingTx(
      blockchainProvider,
      txBuilder,
      poolStakeAssetNameHex
    );

    return jsonResponse(200, { txHash, poolStakeAssetNameHex }, auth.origin);
  } catch (error) {
    console.error('Batching error:', error);
    return jsonResponse(
      500,
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      auth.origin
    );
  }
};
