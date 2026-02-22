import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MaestroProvider, mConStr0, MeshTxBuilder, UTxO } from '@meshsdk/core';
import {
  OrderValidatorRewardAddress,
  OrderValidatorScript,
} from './e2e/order/validator';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};

    const walletAddress = String(body?.walletAddress ?? '');
    const walletVK = String(body?.walletVK ?? '');
    const walletCollateral = (body?.walletCollateral ?? null) as UTxO | null;
    const walletUtxos = (body?.walletUtxos ?? []) as UTxO[];
    const orderTxHash = String(body?.orderTxHash ?? '');

    if (!walletAddress || !walletVK || !walletCollateral || !orderTxHash) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
        body: JSON.stringify({
          error:
            'Missing required fields: walletAddress, walletVK, walletCollateral, orderTxHash',
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

    const orderUtxos = await provider.fetchUTxOs(orderTxHash, 0);
    const orderUtxo = orderUtxos[0];
    if (!orderUtxo) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
        body: JSON.stringify({ error: 'Order UTxO not found' }),
      };
    }

    const unsignedTx = await txBuilder
      .spendingPlutusScriptV3()
      .txIn(
        orderUtxo.input.txHash,
        orderUtxo.input.outputIndex,
        orderUtxo.output.amount,
        orderUtxo.output.address
      )
      .txInScript(OrderValidatorScript)
      .spendingReferenceTxInInlineDatumPresent()
      .spendingReferenceTxInRedeemerValue('')
      .withdrawalPlutusScriptV3()
      .withdrawal(OrderValidatorRewardAddress, '0')
      .withdrawalScript(OrderValidatorScript)
      .withdrawalRedeemerValue(mConStr0([]))
      .txOut(walletAddress, orderUtxo.output.amount)
      .txInCollateral(
        walletCollateral.input.txHash,
        walletCollateral.input.outputIndex
      )
      .setTotalCollateral('5000000')
      .changeAddress(walletAddress)
      .selectUtxosFrom(walletUtxos)
      .requiredSignerHash(walletVK)
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
    console.error('Build cancel order tx error:', error);
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
