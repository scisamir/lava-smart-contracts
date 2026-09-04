import { ScheduledEvent } from 'aws-lambda';
import {
  deserializeDatum,
  type MaestroProvider,
  type MeshTxBuilder,
} from '@meshsdk/core';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { batchingTx } from './e2e/batching/batching';
import { OrderValidatorAddr } from './e2e/order/validator';
import { OrderDatumType } from './e2e/types';
import {
  applyLiveProtocolParams,
  createMaestroProvider,
  createMeshTxBuilder,
} from './cardano';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const MIN_ORDER_AGE_MS = 60_000;

type PendingInfo = {
  totalCounts: Record<string, number>;
  eligibleCounts: Record<string, number>;
  eligibleOrderKeysByPool: Record<string, Set<string>>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRateLimitError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('API rate limit exceeded') || message.includes('"status":429');
};

const resolveOrderFirstSeenAt = async (
  tableName: string,
  txHash: string,
  outputIndex: number,
  poolSAN: string
): Promise<number> => {
  const pk = `ORDER#${txHash}#${outputIndex}`;
  const sk = 'TRACKING';

  try {
    const existing = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: { pk, sk },
      })
    );

    if (existing.Item && typeof existing.Item.firstSeenAt === 'number') {
      return existing.Item.firstSeenAt;
    }

    const now = Date.now();
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          pk,
          sk,
          entityType: 'ORDER_TRACKING',
          txHash,
          outputIndex,
          poolSAN,
          firstSeenAt: now,
          createdAtIso: new Date(now).toISOString(),
        },
      })
    );
    return now;
  } catch (err) {
    console.warn(`Failed to resolve firstSeenAt for order ${txHash}#${outputIndex}:`, err);
    return Date.now();
  }
};

const getPendingOrdersInfo = async (
  maestro: MaestroProvider,
  tableName?: string
): Promise<PendingInfo> => {
  const orderUtxos = await maestro.fetchAddressUTxOs(OrderValidatorAddr);
  const totalCounts: Record<string, number> = {};
  const eligibleCounts: Record<string, number> = {};
  const eligibleOrderKeysByPool: Record<string, Set<string>> = {};

  const now = Date.now();

  for (const utxo of orderUtxos) {
    const orderPlutusData = utxo.output.plutusData;
    if (!orderPlutusData) continue;

    const orderDatum = deserializeDatum<OrderDatumType>(orderPlutusData);
    const poolSAN = String(orderDatum.fields[3].bytes ?? '').trim();
    if (!poolSAN) {
      continue;
    }

    totalCounts[poolSAN] = (totalCounts[poolSAN] ?? 0) + 1;

    const txHash = utxo.input.txHash;
    const outputIndex = Number(utxo.input.outputIndex);
    const orderKey = `${txHash}#${outputIndex}`;

    let isEligible = true;
    if (tableName) {
      const firstSeenAt = await resolveOrderFirstSeenAt(
        tableName,
        txHash,
        outputIndex,
        poolSAN
      );
      const ageMs = now - firstSeenAt;
      if (ageMs < MIN_ORDER_AGE_MS) {
        isEligible = false;
      }
    }

    if (isEligible) {
      eligibleCounts[poolSAN] = (eligibleCounts[poolSAN] ?? 0) + 1;
      if (!eligibleOrderKeysByPool[poolSAN]) {
        eligibleOrderKeysByPool[poolSAN] = new Set<string>();
      }
      eligibleOrderKeysByPool[poolSAN].add(orderKey);
    }
  }

  return {
    totalCounts,
    eligibleCounts,
    eligibleOrderKeysByPool,
  };
};

const runBatch = async (
  poolStakeAssetNameHex: string,
  blockchainProvider: MaestroProvider,
  txBuilder: MeshTxBuilder,
  eligibleOrderKeys?: Set<string>
): Promise<string> => {
  return batchingTx(blockchainProvider, txBuilder, poolStakeAssetNameHex, eligibleOrderKeys);
};

export const handler = async (_event: ScheduledEvent) => {
  const maestroKey = process.env.MAESTRO_API_KEY;
  if (!maestroKey) {
    throw new Error('MAESTRO_API_KEY is missing');
  }

  const batcherWalletPassphrase = process.env.BATCHER_WALLET_PASSPHRASE;

  if (!batcherWalletPassphrase) {
    throw new Error('BATCHER_WALLET_PASSPHRASE is missing');
  }

  const tableName = process.env.TABLE_NAME;
  const blockchainProvider = createMaestroProvider(maestroKey);

  const { totalCounts, eligibleCounts, eligibleOrderKeysByPool } = await getPendingOrdersInfo(
    blockchainProvider,
    tableName
  );

  const queue = Object.entries(eligibleCounts)
    .filter(([, totalOrders]) => totalOrders > 0)
    .map(([poolStakeAssetNameHex]) => poolStakeAssetNameHex);

  if (queue.length === 0) {
    console.log('Auto batch skipped: no eligible pending orders (older than 60s)', {
      totalCounts,
      eligibleCounts,
    });
    return {
      ran: false,
      pending: totalCounts,
      eligible: eligibleCounts,
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
        const txBuilder = createMeshTxBuilder(blockchainProvider);
        await applyLiveProtocolParams(txBuilder, blockchainProvider);

        successTxHash = await runBatch(
          poolStakeAssetNameHex,
          blockchainProvider,
          txBuilder,
          eligibleOrderKeysByPool[poolStakeAssetNameHex]
        );
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
    totalCounts,
    eligibleCounts,
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
    pending: totalCounts,
    eligible: eligibleCounts,
    results,
  };
};
