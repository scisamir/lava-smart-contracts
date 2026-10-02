import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UTxO } from '@meshsdk/core';
import { setupE2e } from './e2e/setup';
import { jsonResponse, normalizeCardanoAddress, parseJsonBody, verifyAccessToken } from './security';
import {
  applyLiveProtocolParams,
  createMaestroProvider,
  createMeshTxBuilder,
  formatErrorMessage,
  repairScriptIntegrityHash,
} from './cardano';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const auth = await verifyAccessToken(event);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = parseJsonBody<Record<string, unknown>>(event) ?? {};

    const walletAddress = String(body?.walletAddress ?? '');
    const walletCollateral = (body?.walletCollateral ?? null) as UTxO | null;
    const walletUtxos = (body?.walletUtxos ?? []) as UTxO[];

    if (normalizeCardanoAddress(walletAddress) !== auth.address) {
      return jsonResponse(403, { error: 'Wallet address does not match authorization token' }, auth.origin);
    }

    if (!walletAddress) {
      return jsonResponse(
        400,
        {
          error: 'Missing required field: walletAddress',
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

    const {
      alwaysSuccessMintValidatorHash,
      alwaysSuccessValidatorMintScript,
      tPulseAssetName,
      tStrikeAssetName,
    } = setupE2e();

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

    const unsignedTx = await txBuilder
      .mintPlutusScriptV3()
      .mint('1000', alwaysSuccessMintValidatorHash, tStrikeAssetName)
      .mintingScript(alwaysSuccessValidatorMintScript)
      .mintRedeemerValue('')
      .mintPlutusScriptV3()
      .mint('1000', alwaysSuccessMintValidatorHash, tPulseAssetName)
      .mintingScript(alwaysSuccessValidatorMintScript)
      .mintRedeemerValue('')
      .txInCollateral(
        collateral.input.txHash,
        collateral.input.outputIndex,
        collateral.output?.amount,
        collateral.output?.address || walletAddress
      )
      .setTotalCollateral('5000000')
      .changeAddress(walletAddress)
      .selectUtxosFrom(userUtxos)
      .complete();

    return jsonResponse(200, {
      unsignedTx: await repairScriptIntegrityHash(unsignedTx, maestroKey),
    }, auth.origin);
  } catch (error) {
    console.error('Build mint test tokens tx error:', error);
    return jsonResponse(
      500,
      {
        error: formatErrorMessage(error),
      },
      auth.origin
    );
  }
};
