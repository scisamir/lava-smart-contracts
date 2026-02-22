import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MaestroProvider, MeshTxBuilder, UTxO } from '@meshsdk/core';
import { setupE2e } from './e2e/setup';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};

    const walletAddress = String(body?.walletAddress ?? '');
    const walletCollateral = (body?.walletCollateral ?? null) as UTxO | null;
    const walletUtxos = (body?.walletUtxos ?? []) as UTxO[];

    if (!walletAddress || !walletCollateral) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
        body: JSON.stringify({
          error: 'Missing required fields: walletAddress, walletCollateral',
        }),
      };
    }

    const maestroKey = process.env.MAESTRO_API_KEY;
    if (!maestroKey) {
      throw new Error('MAESTRO_API_KEY is missing');
    }

    const provider = new MaestroProvider({
      network: 'Preprod',
      apiKey: maestroKey,
    });

    const txBuilder = new MeshTxBuilder({
      fetcher: provider,
      submitter: provider,
      evaluator: provider,
      verbose: true,
    });
    txBuilder.setNetwork('preprod');

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
    console.error('Build mint test tokens tx error:', error);
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
