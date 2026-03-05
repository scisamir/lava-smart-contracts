import { ScheduledEvent } from 'aws-lambda';
import {
  MaestroProvider,
  MeshTxBuilder,
  deserializeDatum,
  stringToHex,
} from '@meshsdk/core';
import { batchingTxTest } from './e2e/batching/batchingTest';
import { batchingTxStrike } from './e2e/batching/batchingStrike';
import { batchingTxPulse } from './e2e/batching/batchingPulse';
import { OrderValidatorAddr } from './e2e/order/validator';
import { setupE2e } from './e2e/setup';
import { MintingHash } from './e2e/mint/validator';
import { OrderDatumType } from './e2e/types';

type BatchType = 'test' | 'tStrike' | 'tPulse';

type PendingCounts = {
  test: number;
  tStrike: number;
  tPulse: number;
};

const getPendingCounts = async (maestro: MaestroProvider): Promise<PendingCounts> => {
  const orderUtxos = await maestro.fetchAddressUTxOs(OrderValidatorAddr);
  const { alwaysSuccessMintValidatorHash } = setupE2e();

  const totalOrders: PendingCounts = { test: 0, tStrike: 0, tPulse: 0 };

  orderUtxos.forEach((utxo) => {
    const orderPlutusData = utxo.output.plutusData;
    if (!orderPlutusData) return;

    const orderDatum = deserializeDatum<OrderDatumType>(orderPlutusData);
    const mintAmtDatum = Number(orderDatum.fields[0].fields[0].int);
    if (mintAmtDatum <= 0) return;

    const utxoAmount = utxo.output.amount;
    for (let i = 0; i < utxoAmount.length; i++) {
      const utxoAsset = utxoAmount[i];

      if (
        utxoAsset.unit === alwaysSuccessMintValidatorHash + stringToHex('test') ||
        utxoAsset.unit === MintingHash + stringToHex('stTest')
      ) {
        totalOrders.test += 1;
        break;
      }

      if (
        utxoAsset.unit === alwaysSuccessMintValidatorHash + stringToHex('tStrike') ||
        utxoAsset.unit === MintingHash + stringToHex('LStrike')
      ) {
        totalOrders.tStrike += 1;
        break;
      }

      if (
        utxoAsset.unit === alwaysSuccessMintValidatorHash + stringToHex('tPulse') ||
        utxoAsset.unit === MintingHash + stringToHex('LPulse')
      ) {
        totalOrders.tPulse += 1;
        break;
      }
    }
  });

  return totalOrders;
};

const runBatch = async (
  batchType: BatchType,
  blockchainProvider: MaestroProvider,
  txBuilder: MeshTxBuilder
): Promise<string> => {
  if (batchType === 'test') {
    return batchingTxTest(blockchainProvider, txBuilder);
  }

  if (batchType === 'tStrike') {
    return batchingTxStrike(blockchainProvider, txBuilder);
  }

  return batchingTxPulse(blockchainProvider, txBuilder);
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
    network: 'Preprod',
    apiKey: maestroKey,
  });

  const pending = await getPendingCounts(blockchainProvider);

  const queue: BatchType[] = [];
  if (pending.test > 0) queue.push('test');
  if (pending.tStrike > 0) queue.push('tStrike');
  if (pending.tPulse > 0) queue.push('tPulse');

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
    try {
      const txBuilder = new MeshTxBuilder({
        fetcher: blockchainProvider,
        submitter: blockchainProvider,
        evaluator: blockchainProvider,
        verbose: true,
      });
      txBuilder.setNetwork('preprod');

      const txHash = await runBatch(batchType, blockchainProvider, txBuilder);
      results.push({ batchType, txHash });
    } catch (error) {
      console.error(`Auto batch failed for ${batchType}:`, error);
      results.push({
        batchType,
        error: error instanceof Error ? error.message : String(error),
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
