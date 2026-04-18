import { ScheduledEvent } from 'aws-lambda';
import {
  MaestroProvider,
  MeshTxBuilder,
  deserializeDatum,
} from '@meshsdk/core';
import { batchingTxTest } from './e2e/batching/batchingTest';
import { batchingTxStrike } from './e2e/batching/batchingStrike';
import { batchingTxPulse } from './e2e/batching/batchingPulse';
import { batchingTx } from './e2e/batching/batching';
import { OrderValidatorAddr } from './e2e/order/validator';
import { setupE2e } from './e2e/setup';
import { OrderDatumType } from './e2e/types';

type BatchType = 'test' | 'tStrike' | 'tPulse' | 'atrium';

type PendingCounts = {
  test: number;
  tStrike: number;
  tPulse: number;
  atrium: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRateLimitError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('API rate limit exceeded') || message.includes('"status":429');
};

const getPendingCounts = async (maestro: MaestroProvider): Promise<PendingCounts> => {
  const orderUtxos = await maestro.fetchAddressUTxOs(OrderValidatorAddr);
  const {
    poolStakeAssetName,
    tStrikePoolStakeAssetName,
    tPulsePoolStakeAssetName,
    ATRIUM_POOL_STAKE_ASSET_NAME,
  } = setupE2e();

  const totalOrders: PendingCounts = { test: 0, tStrike: 0, tPulse: 0, atrium: 0 };

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

  return totalOrders;
};

const runBatch = async (
  batchType: BatchType,
  blockchainProvider: MaestroProvider,
  txBuilder: MeshTxBuilder
): Promise<string> => {
  const { ATRIUM_POOL_STAKE_ASSET_NAME } = setupE2e();

  if (batchType === 'test') {
    return batchingTxTest(blockchainProvider, txBuilder);
  }

  if (batchType === 'tStrike') {
    return batchingTxStrike(blockchainProvider, txBuilder);
  }

  if (batchType === 'tPulse') {
    return batchingTxPulse(blockchainProvider, txBuilder);
  }

  return batchingTx(blockchainProvider, txBuilder, ATRIUM_POOL_STAKE_ASSET_NAME);
};

export const handler = async (_event: ScheduledEvent) => {
  const maestroKey = process.env.MAESTRO_API_KEY;
  if (!maestroKey) {
    throw new Error('MAESTRO_API_KEY is missing');
  }

  const batcherWalletPassphrase =
    process.env.BATCHER_WALLET_PASSPHRASE || process.env.NEXT_PUBLIC_WALLET_PASSPHRASE_ONE;

  if (!batcherWalletPassphrase) {
    throw new Error('BATCHER_WALLET_PASSPHRASE is missing');
  }

  process.env.NEXT_PUBLIC_WALLET_PASSPHRASE_ONE = batcherWalletPassphrase;

  const blockchainProvider = new MaestroProvider({
    network: 'Mainnet',
    apiKey: maestroKey,
  });

  const pending = await getPendingCounts(blockchainProvider);

  const queue: BatchType[] = [];
  if (pending.test > 0) queue.push('test');
  if (pending.tStrike > 0) queue.push('tStrike');
  if (pending.tPulse > 0) queue.push('tPulse');
  if (pending.atrium > 0) queue.push('atrium');

  if (queue.length === 0) {
    console.log('Auto batch skipped: no pending orders', pending);
    return {
      ran: false,
      pending,
      processed: [],
    };
  }

  const results: Array<{ batchType: BatchType; txHash?: string; error?: string }> = [];

  for (const batchType of queue) {
    const maxAttempts = 4;
    let successTxHash: string | null = null;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const txBuilder = new MeshTxBuilder({
          fetcher: blockchainProvider,
          submitter: blockchainProvider,
          evaluator: blockchainProvider,
          verbose: false,
        });
        txBuilder.setNetwork('mainnet');

        successTxHash = await runBatch(batchType, blockchainProvider, txBuilder);
        break;
      } catch (error) {
        lastError = error;

        if (attempt < maxAttempts && isRateLimitError(error)) {
          const waitMs = 1200 * attempt;
          console.warn(
            `Auto batch ${batchType} hit Maestro rate limit (attempt ${attempt}/${maxAttempts}), retrying in ${waitMs}ms`
          );
          await sleep(waitMs);
          continue;
        }

        break;
      }
    }

    if (successTxHash) {
      results.push({ batchType, txHash: successTxHash });
      await sleep(800);
    } else {
      console.error(`Auto batch failed for ${batchType}:`, lastError);
      results.push({
        batchType,
        error: lastError instanceof Error ? lastError.message : String(lastError),
      });
    }
  }

  console.log('Auto batch run result', {
    pending,
    results,
  });

  const failedResults = results.filter((r) => r.error);
  if (failedResults.length > 0) {
    throw new Error(
      `Auto batch run failed for ${failedResults.length}/${results.length} batch types: ${JSON.stringify(
        failedResults
      )}`
    );
  }

  return {
    ran: true,
    pending,
    results,
  };
};
