import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MaestroProvider, MeshTxBuilder } from '@meshsdk/core';
import { batchingTx } from './e2e/batching/batching';
import { setupE2e } from './e2e/setup';

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
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const batchTypeOrPoolKey = String(body?.batchType ?? body?.poolStakeAssetNameHex ?? '').trim();
    const poolStakeAssetNameHex = resolvePoolStakeAssetNameHex(batchTypeOrPoolKey);

    if (!poolStakeAssetNameHex) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
        body: JSON.stringify({
          error: 'Invalid or missing batchType/poolStakeAssetNameHex',
        }),
      };
    }

    const maestroKey = process.env.MAESTRO_API_KEY;
    if (!maestroKey) {
      throw new Error('MAESTRO_API_KEY is missing');
    }

    const batcherWalletPassphrase =
      process.env.BATCHER_WALLET_PASSPHRASE ||
      process.env.NEXT_PUBLIC_WALLET_PASSPHRASE_ONE;

    if (!batcherWalletPassphrase) {
      throw new Error('BATCHER_WALLET_PASSPHRASE is missing');
    }

    // Reuse existing batching functions that read this env var.
    process.env.NEXT_PUBLIC_WALLET_PASSPHRASE_ONE = batcherWalletPassphrase;

    const blockchainProvider = new MaestroProvider({
      network: 'Mainnet',
      apiKey: maestroKey,
    });

    const txBuilder = new MeshTxBuilder({
      fetcher: blockchainProvider,
      submitter: blockchainProvider,
      evaluator: blockchainProvider,
      verbose: true,
    });
    txBuilder.setNetwork('mainnet');

    const txHash = await batchingTx(blockchainProvider, txBuilder, poolStakeAssetNameHex);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      },
      body: JSON.stringify({ txHash, poolStakeAssetNameHex }),
    };
  } catch (error) {
    console.error('Batching error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
    };
  }
};