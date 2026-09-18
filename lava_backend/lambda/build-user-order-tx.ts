import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  Asset,
  deserializeDatum,
  mConStr0,
  mPubKeyAddress,
  type MaestroProvider,
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
import {
  GlobalSettingsAddr,
  gsParamTxHash,
  gsParamTxIdx,
} from './e2e/global_settings/validator';
import { PoolValidatorAddr } from './e2e/pool/validator';
import { PoolDatumType } from './e2e/types';
import { jsonResponse, normalizeCardanoAddress, parseJsonBody, verifyAccessToken } from './security';
import {
  applyLiveProtocolParams,
  createMaestroProvider,
  createMeshTxBuilder,
  repairScriptIntegrityHash,
} from './cardano';

type OrderKind = 'opt-in' | 'redeem';

const toLovelace = (amount: number): bigint => BigInt(Math.floor(amount * 1_000_000));

const toIntegerAmount = (amount: number): bigint => BigInt(Math.floor(amount));

const addOrMergeAsset = (assets: Asset[], unit: string, quantity: bigint) => {
  if (quantity <= 0n) return;

  const existing = assets.find((asset) => asset.unit === unit);
  if (existing) {
    existing.quantity = (BigInt(existing.quantity) + quantity).toString();
    return;
  }

  assets.push({ unit, quantity: quantity.toString() });
};

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

    if (datumPoolSan !== poolStakeAssetName) continue;

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
  const auth = await verifyAccessToken(event);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = parseJsonBody<Record<string, unknown>>(event) ?? {};

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

    if (normalizeCardanoAddress(walletAddress) !== auth.address) {
      return jsonResponse(403, { error: 'Wallet address does not match authorization token' }, auth.origin);
    }

    if (!orderType || !['opt-in', 'redeem'].includes(orderType)) {
      return jsonResponse(400, { error: 'Invalid or missing orderType' }, auth.origin);
    }

    if (!walletAddress || !walletVK || !tokenName || amount <= 0) {
      return jsonResponse(
        400,
        {
          error:
            'Missing or invalid fields: walletAddress, walletVK, tokenName, amount',
        },
        auth.origin
      );
    }

    const maestroKey = process.env.MAESTRO_API_KEY;
    if (!maestroKey) {
      throw new Error('MAESTRO_API_KEY is missing');
    }

    const provider = createMaestroProvider(maestroKey);
    const txBuilder = createMeshTxBuilder(provider);
    await applyLiveProtocolParams(txBuilder, provider);

    const defaultConfig = resolvePoolConfig(tokenName);
    const poolStakeAssetName = requestedPoolStakeAssetName || defaultConfig?.poolStakeAssetName;

    let underlyingUnit = requestedUnderlyingUnit || defaultConfig?.underlyingUnit;
    if (!underlyingUnit && poolStakeAssetName) {
      underlyingUnit = await resolveUnderlyingUnitFromPool(provider, poolStakeAssetName);
    }

    if (!poolStakeAssetName || !underlyingUnit) {
      throw new Error('Unable to resolve pool configuration from tokenName');
    }

    const normalizedAmount =
      orderType === 'opt-in' && underlyingUnit === 'lovelace'
        ? toLovelace(amount)
        : toIntegerAmount(amount);

    if (normalizedAmount <= 0n) {
      throw new Error('Amount is too small after unit conversion');
    }

    const orderValue: Asset[] = [];
    addOrMergeAsset(orderValue, 'lovelace', 2_500_000n);

    if (orderType === 'opt-in') {
      addOrMergeAsset(orderValue, underlyingUnit, normalizedAmount);
    } else {
      addOrMergeAsset(orderValue, MintingHash + poolStakeAssetName, normalizedAmount);
    }

    addOrMergeAsset(orderValue, OrderValidatorHash, 1n);

    const datum = orderDatum(
      orderType === 'opt-in'
        ? optInOrderType(normalizedAmount)
        : redeemOrderType(normalizedAmount),
      mPubKeyAddress(walletVK, walletSK),
      verificationKeySigner(walletVK),
      poolStakeAssetName
    );

    const gsUtxo = (await provider.fetchAddressUTxOs(GlobalSettingsAddr))[0];

    const userUtxos =
      Array.isArray(walletUtxos) &&
      walletUtxos.length > 0 &&
      walletUtxos.every((u) => u?.output?.amount)
        ? walletUtxos
        : await provider.fetchAddressUTxOs(walletAddress);

    const hasValidCollateral =
      walletCollateral &&
      walletCollateral.input?.txHash &&
      walletCollateral.output?.amount;

    const fallbackCollateral = [...userUtxos]
      .filter((utxo) =>
        utxo?.output?.amount?.length === 1 &&
        utxo.output.amount[0]?.unit === 'lovelace' &&
        BigInt(utxo.output.amount[0]?.quantity ?? '0') >= 5_000_000n
      )
      .sort((a, b) => Number(BigInt(b.output.amount[0].quantity) - BigInt(a.output.amount[0].quantity)))[0];

    const collateral = hasValidCollateral ? walletCollateral : fallbackCollateral;
    if (!collateral) {
      throw new Error('No collateral UTxO found. Please ensure your wallet has at least 5 ADA collateral.');
    }

    const gsReference = gsUtxo
      ? { txHash: gsUtxo.input.txHash, outputIndex: gsUtxo.input.outputIndex }
      : { txHash: gsParamTxHash, outputIndex: gsParamTxIdx };

    if (!gsUtxo) {
      console.warn(
        'Global settings UTxO not found at derived address; falling back to configured output reference.'
      );
    }

    let builder = txBuilder
      .readOnlyTxInReference(gsReference.txHash, gsReference.outputIndex)
      .mintPlutusScriptV3()
      .mint('1', OrderValidatorHash, '')
      .mintingScript(OrderValidatorScript)
      .mintRedeemerValue(mConStr0([]))
      .txOut(OrderValidatorAddr, orderValue)
      .txOutInlineDatumValue(datum)
      .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
      .setTotalCollateral('5000000')
      .requiredSignerHash(walletVK)
      .changeAddress(walletAddress)
      .selectUtxosFrom(userUtxos);

    const unsignedTx = await builder.complete();

    return jsonResponse(200, {
      unsignedTx: await repairScriptIntegrityHash(unsignedTx, maestroKey),
    }, auth.origin);
  } catch (error) {
    console.error('Build user order tx error:', error);
    return jsonResponse(
      500,
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      auth.origin
    );
  }
};
