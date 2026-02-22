import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MaestroProvider, MeshTxBuilder } from '@meshsdk/core';
import { batchingTxTest } from './e2e/batching/batchingTest';
import { batchingTxStrike } from './e2e/batching/batchingStrike';
import { batchingTxPulse } from './e2e/batching/batchingPulse';

type BatchType = 'test' | 'tStrike' | 'tPulse';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const batchType = body?.batchType as BatchType;

    if (!batchType || !['test', 'tStrike', 'tPulse'].includes(batchType)) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
        body: JSON.stringify({ error: 'Invalid or missing batchType' }),
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
      network: 'Preprod',
      apiKey: maestroKey,
    });

    const txBuilder = new MeshTxBuilder({
      fetcher: blockchainProvider,
      submitter: blockchainProvider,
      evaluator: blockchainProvider,
      verbose: true,
    });
    txBuilder.setNetwork('preprod');

    const txHash =
      batchType === 'test'
        ? await batchingTxTest(blockchainProvider, txBuilder)
        : batchType === 'tStrike'
        ? await batchingTxStrike(blockchainProvider, txBuilder)
        : await batchingTxPulse(blockchainProvider, txBuilder);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      },
      body: JSON.stringify({ txHash, batchType }),
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