import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MaestroProvider, MeshTxBuilder, UTxO } from '@meshsdk/core';
import { setupE2e } from './e2e/setup';
import { jsonResponse, normalizeCardanoAddress, parseJsonBody, verifyAccessToken } from './security';

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

    if (!walletAddress || !walletCollateral) {
      return jsonResponse(
        400,
        {
          error: 'Missing required fields: walletAddress, walletCollateral',
        },
        auth.origin
      );
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
      verbose: false,
    });
    txBuilder.setNetwork('mainnet');

    const {
      alwaysSuccessMintValidatorHash,
      alwaysSuccessValidatorMintScript,
      tPulseAssetName,
      tStrikeAssetName,
    } = setupE2e();

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
        walletCollateral.input.txHash,
        walletCollateral.input.outputIndex
      )
      .setTotalCollateral('5000000')
      .changeAddress(walletAddress)
      .selectUtxosFrom(walletUtxos)
      .complete();

    return jsonResponse(200, { unsignedTx }, auth.origin);
  } catch (error) {
    console.error('Build mint test tokens tx error:', error);
    return jsonResponse(
      500,
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      auth.origin
    );
  }
};
