import { ScheduledEvent } from 'aws-lambda';
import {
  MaestroProvider,
  MeshTxBuilder,
  deserializeDatum,
} from '@meshsdk/core';
import { batchingTx } from './e2e/batching/batching';
import { OrderValidatorAddr } from './e2e/order/validator';
import { OrderDatumType } from './e2e/types';

type PendingCounts = Record<string, number>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRateLimitError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('API rate limit exceeded') || message.includes('"status":429');
};

const getPendingCounts = async (maestro: MaestroProvider): Promise<PendingCounts> => {
  const orderUtxos = await maestro.fetchAddressUTxOs(OrderValidatorAddr);
  const totalOrders: PendingCounts = {};

  orderUtxos.forEach((utxo) => {
    const orderPlutusData = utxo.output.plutusData;
    if (!orderPlutusData) return;

    const orderDatum = deserializeDatum<OrderDatumType>(orderPlutusData);
    const poolSAN = String(orderDatum.fields[3].bytes ?? '').trim();
    if (!poolSAN) {
      return;
    }

    totalOrders[poolSAN] = (totalOrders[poolSAN] ?? 0) + 1;
  });

  return totalOrders;
};

const runBatch = async (
  poolStakeAssetNameHex: string,
  blockchainProvider: MaestroProvider,
  txBuilder: MeshTxBuilder
): Promise<string> => {
  return batchingTx(blockchainProvider, txBuilder, poolStakeAssetNameHex);
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

  const queue = Object.entries(pending)
    .filter(([, totalOrders]) => totalOrders > 0)
    .map(([poolStakeAssetNameHex]) => poolStakeAssetNameHex);

  if (queue.length === 0) {
    console.log('Auto batch skipped: no pending orders', pending);
    return {
      ran: false,
      pending,
      processed: [],
    };
  }

  const results: Array<{ poolStakeAssetNameHex: string; txHash?: string; error?: string }> = [];

  for (const poolStakeAssetNameHex of queue) {
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

        successTxHash = await runBatch(poolStakeAssetNameHex, blockchainProvider, txBuilder);
        break;
      } catch (error) {
        lastError = error;

        if (attempt < maxAttempts && isRateLimitError(error)) {
          const waitMs = 1200 * attempt;
          console.warn(
            `Auto batch ${poolStakeAssetNameHex} hit Maestro rate limit (attempt ${attempt}/${maxAttempts}), retrying in ${waitMs}ms`
          );
          await sleep(waitMs);
          continue;
        }

        break;
      }
    }

    if (successTxHash) {
      results.push({ poolStakeAssetNameHex, txHash: successTxHash });
      await sleep(800);
    } else {
      console.error(`Auto batch failed for ${poolStakeAssetNameHex}:`, lastError);
      results.push({
        poolStakeAssetNameHex,
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
