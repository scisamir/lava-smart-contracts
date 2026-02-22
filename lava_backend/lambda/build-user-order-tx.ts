import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  mConStr0,
  mConStr1,
  mPubKeyAddress,
  MaestroProvider,
  MeshTxBuilder,
  stringToHex,
  UTxO,
} from '@meshsdk/core';
import { setupE2e } from './e2e/setup';
import { OrderValidatorAddr } from './e2e/order/validator';
import { MintingHash } from './e2e/mint/validator';

type OrderKind = 'opt-in' | 'redeem';

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

    const { alwaysSuccessMintValidatorHash } = setupE2e();

    const tokenUnit =
      orderType === 'opt-in'
        ? alwaysSuccessMintValidatorHash + stringToHex(tokenName)
        : MintingHash + stringToHex(tokenName);

    const orderDatum = mConStr0([
      orderType === 'opt-in' ? mConStr0([amount]) : mConStr1([amount]),
      mPubKeyAddress(walletVK, walletSK),
      walletVK,
    ]);

    const unsignedTx = await txBuilder
      .txOut(OrderValidatorAddr, [
        { unit: 'lovelace', quantity: String(2_000_000) },
        { unit: tokenUnit, quantity: String(amount) },
      ])
      .txOutInlineDatumValue(orderDatum)
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
