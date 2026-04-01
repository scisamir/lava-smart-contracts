import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  Asset,
  deserializeDatum,
  mConStr0,
  mPubKeyAddress,
  MaestroProvider,
  MeshTxBuilder,
  UTxO,
} from '@meshsdk/core';
import { setupE2e } from './e2e/setup';
import {
  optInOrderType,
  orderDatum,
  redeemOrderType,
  verificationKeySigner,
} from './e2e/data';
import {
  OrderValidatorAddr,
  OrderValidatorHash,
  OrderValidatorScript,
} from './e2e/order/validator';
import { MintingHash } from './e2e/mint/validator';
import { GlobalSettingsAddr } from './e2e/global_settings/validator';
import { PoolValidatorAddr } from './e2e/pool/validator';
import { PoolDatumType } from './e2e/types';

type OrderKind = 'opt-in' | 'redeem';

const resolvePoolConfig = (tokenName: string) => {
  const {
    testUnit,
    poolStakeAssetName,
    tStrikeUnit,
    tStrikePoolStakeAssetName,
    tPulseUnit,
    tPulsePoolStakeAssetName,
    ATRIUM_POOL_STAKE_ASSET_NAME,
  } = setupE2e();

  if (['test', 'stTest'].includes(tokenName)) {
    return { poolStakeAssetName, underlyingUnit: testUnit };
  }
  if (['tStrike', 'LStrike'].includes(tokenName)) {
    return { poolStakeAssetName: tStrikePoolStakeAssetName, underlyingUnit: tStrikeUnit };
  }
  if (['tPulse', 'LPulse'].includes(tokenName)) {
    return { poolStakeAssetName: tPulsePoolStakeAssetName, underlyingUnit: tPulseUnit };
  }
  if (['ADA', 'LADA', 'atrium'].includes(tokenName)) {
    return { poolStakeAssetName: ATRIUM_POOL_STAKE_ASSET_NAME, underlyingUnit: 'lovelace' };
  }

  return null;
};

const resolveUnderlyingUnitFromPool = async (
  provider: MaestroProvider,
  poolStakeAssetName: string
) => {
  const poolUtxos = await provider.fetchAddressUTxOs(PoolValidatorAddr);

  for (const utxo of poolUtxos) {
    const plutusData = utxo.output.plutusData;
    if (!plutusData) continue;

    const poolDatum = deserializeDatum<PoolDatumType>(plutusData);
    const datumPoolSan = String(poolDatum.fields[6].bytes ?? '');

    if (datumPoolSan !== poolStakeAssetName) {
      continue;
    }

    const assetField = poolDatum.fields[5];
    const policyId = String(assetField.fields[1].bytes ?? '');
    const assetName = String(assetField.fields[2].bytes ?? '');

    if (!policyId && !assetName) {
      return 'lovelace';
    }

    return `${policyId}${assetName}`;
  }

  throw new Error(`Pool config not found for pool SAN ${poolStakeAssetName}`);
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};

    const orderType = body?.orderType as OrderKind;
    const amount = Number(body?.amount ?? 0);
    const tokenName = String(body?.tokenName ?? '');
    const walletAddress = String(body?.walletAddress ?? '');
    const walletVK = String(body?.walletVK ?? '');
    const walletSK = String(body?.walletSK ?? '');
    const walletUtxos = (body?.walletUtxos ?? []) as UTxO[];
    const requestedPoolStakeAssetName = String(body?.poolStakeAssetName ?? '');
    const requestedUnderlyingUnit = String(body?.underlyingUnit ?? '');
    const walletCollateral = (body?.walletCollateral ?? null) as UTxO | null;

    if (!orderType || !['opt-in', 'redeem'].includes(orderType)) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
        body: JSON.stringify({ error: 'Invalid or missing orderType' }),
      };
    }

    if (!walletAddress || !walletVK || !tokenName || amount <= 0) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
        body: JSON.stringify({
          error:
            'Missing or invalid fields: walletAddress, walletVK, tokenName, amount',
        }),
      };
    }

    const maestroKey = process.env.MAESTRO_API_KEY;
    if (!maestroKey) {
      throw new Error('MAESTRO_API_KEY is missing');
    }

    const provider = new MaestroProvider({
      network: 'Mainnet',
      apiKey: maestroKey,
    });

    const txBuilder = new MeshTxBuilder({
      fetcher: provider,
      submitter: provider,
      evaluator: provider,
      verbose: true,
    });
    txBuilder.setNetwork('mainnet');

    const defaultConfig = resolvePoolConfig(tokenName);
    const poolStakeAssetName = requestedPoolStakeAssetName || defaultConfig?.poolStakeAssetName;

    let underlyingUnit = requestedUnderlyingUnit || defaultConfig?.underlyingUnit;
    if (!underlyingUnit && poolStakeAssetName) {
      underlyingUnit = await resolveUnderlyingUnitFromPool(provider, poolStakeAssetName);
    }

    if (!poolStakeAssetName || !underlyingUnit) {
      throw new Error('Unable to resolve pool configuration from tokenName');
    }

    const orderValue: Asset[] = [{ unit: 'lovelace', quantity: '2500000' }];
    if (orderType === 'opt-in') {
      orderValue.push({
        unit: underlyingUnit,
        quantity: String(amount),
      });
    } else {
      orderValue.push({
        unit: MintingHash + poolStakeAssetName,
        quantity: String(amount),
      });
    }
    orderValue.push({ unit: OrderValidatorHash, quantity: '1' });

    const datum = orderDatum(
      orderType === 'opt-in' ? optInOrderType(amount) : redeemOrderType(amount),
      mPubKeyAddress(walletVK, walletSK),
      verificationKeySigner(walletVK),
      poolStakeAssetName
    );

    const gsUtxo = (await provider.fetchAddressUTxOs(GlobalSettingsAddr))[0];
    if (!gsUtxo) {
      throw new Error('Global settings UTxO not found');
    }

    const fallbackCollateral = [...walletUtxos]
      .filter((utxo) =>
        utxo.output.amount.length === 1 &&
        utxo.output.amount[0].unit === 'lovelace' &&
        BigInt(utxo.output.amount[0].quantity) >= 7_000_000n
      )
      .sort((a, b) => Number(BigInt(b.output.amount[0].quantity) - BigInt(a.output.amount[0].quantity)))[0];

    const collateral = walletCollateral ?? fallbackCollateral;
    if (!collateral) {
      throw new Error('No collateral UTxO found');
    }

    const unsignedTx = await txBuilder
      .txOut(OrderValidatorAddr, orderValue)
      .txOutInlineDatumValue(datum)
      .mintPlutusScriptV3()
      .mint('1', OrderValidatorHash, '')
      .mintingScript(OrderValidatorScript)
      .mintRedeemerValue(mConStr0([]))
      .readOnlyTxInReference(gsUtxo.input.txHash, gsUtxo.input.outputIndex)
      .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
      .setTotalCollateral('5000000')
      .requiredSignerHash(walletVK)
      .changeAddress(walletAddress)
      .selectUtxosFrom(walletUtxos)
      .complete();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      },
      body: JSON.stringify({ unsignedTx }),
    };
  } catch (error) {
    console.error('Build user order tx error:', error);
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
