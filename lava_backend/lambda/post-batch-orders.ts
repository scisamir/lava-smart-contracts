import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MaestroProvider, MeshTxBuilder } from '@meshsdk/core';
import { batchingTxTest } from './e2e/batching/batchingTest';
import { batchingTxStrike } from './e2e/batching/batchingStrike';
import { batchingTxPulse } from './e2e/batching/batchingPulse';
import { batchingTx } from './e2e/batching/batching';
import { setupE2e } from './e2e/setup';
import { jsonResponse, parseJsonBody, verifyAccessToken } from './security';

type BatchType = 'test' | 'tStrike' | 'tPulse' | 'atrium';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const auth = await verifyAccessToken(event, { requiredScopes: ['lava:batch'] });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = parseJsonBody<Record<string, unknown>>(event) ?? {};
    const batchType = body?.batchType as BatchType;

    if (!batchType || !['test', 'tStrike', 'tPulse', 'atrium'].includes(batchType)) {
      return jsonResponse(400, { error: 'Invalid or missing batchType' }, auth.origin);
    }

    const maestroKey = process.env.MAESTRO_API_KEY;
    if (!maestroKey) {
      throw new Error('MAESTRO_API_KEY is missing');
    }

    const batcherWalletPassphrase = process.env.BATCHER_WALLET_PASSPHRASE;

    if (!batcherWalletPassphrase) {
      throw new Error('BATCHER_WALLET_PASSPHRASE is missing');
    }

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

    const { ATRIUM_POOL_STAKE_ASSET_NAME } = setupE2e();

    const txHash =
      batchType === 'test'
        ? await batchingTxTest(blockchainProvider, txBuilder)
        : batchType === 'tStrike'
        ? await batchingTxStrike(blockchainProvider, txBuilder)
        : batchType === 'tPulse'
        ? await batchingTxPulse(blockchainProvider, txBuilder)
        : await batchingTx(blockchainProvider, txBuilder, ATRIUM_POOL_STAKE_ASSET_NAME);

    return jsonResponse(200, { txHash, batchType }, auth.origin);
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