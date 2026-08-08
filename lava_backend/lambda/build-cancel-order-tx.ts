import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  deserializeDatum,
  MaestroProvider,
  mConStr0,
  mConStr1,
  MeshTxBuilder,
  serializeAddressObj,
  UTxO,
} from '@meshsdk/core';
import {
  OrderValidatorHash,
  OrderValidatorScript,
} from './e2e/order/validator';
import { OrderDatumType } from './e2e/types';
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
    const walletVK = String(body?.walletVK ?? '');
    const walletCollateral = (body?.walletCollateral ?? null) as UTxO | null;
    const walletUtxos = (body?.walletUtxos ?? []) as UTxO[];
    const orderTxHash = String(body?.orderTxHash ?? '');
    const orderOutputIndex = Number(body?.orderOutputIndex ?? 0);

    if (!walletAddress || !walletVK || !orderTxHash) {
      return jsonResponse(
        400,
        {
          error:
            'Missing required fields: walletAddress, walletVK, orderTxHash',
        },
        auth.origin
      );
    }

    if (normalizeCardanoAddress(walletAddress) !== auth.address) {
      return jsonResponse(
        403,
        { error: 'Wallet address does not match authorization token' },
        auth.origin
      );
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

    const { NETWORK_ID } = setupE2e();

    const orderUtxos = await provider.fetchUTxOs(orderTxHash, orderOutputIndex);
    const orderUtxo = orderUtxos[0];
    if (!orderUtxo) {
      return jsonResponse(
        409,
        { error: 'Order already batched or cancelled' },
        auth.origin
      );
    }

    const orderPlutusData = orderUtxo.output.plutusData;
    if (!orderPlutusData) {
      throw new Error('Order datum not found');
    }

    const orderDatum = deserializeDatum<OrderDatumType>(orderPlutusData);
    const receiverAddress = serializeAddressObj(orderDatum.fields[1], NETWORK_ID as 0 | 1);
    if (normalizeCardanoAddress(receiverAddress) !== auth.address) {
      return jsonResponse(403, { error: 'Order does not belong to the authenticated wallet' }, auth.origin);
    }

    const outputAmount = orderUtxo.output.amount.filter(
      (asset) => asset.unit !== OrderValidatorHash
    );

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
      .spendingPlutusScriptV3()
      .txIn(
        orderUtxo.input.txHash,
        orderUtxo.input.outputIndex,
        orderUtxo.output.amount,
        orderUtxo.output.address
      )
      .txInScript(OrderValidatorScript)
      .txInInlineDatumPresent()
      .txInRedeemerValue(mConStr0([]))
      .mintPlutusScriptV3()
      .mint('-1', OrderValidatorHash, '')
      .mintingScript(OrderValidatorScript)
      .mintRedeemerValue(mConStr1([]))
      .txOut(receiverAddress, outputAmount)
      .txInCollateral(
        collateral.input.txHash,
        collateral.input.outputIndex
      )
      .setTotalCollateral('5000000')
      .changeAddress(walletAddress)
      .selectUtxosFrom(walletUtxos)
      .requiredSignerHash(walletVK)
      .complete();

    return jsonResponse(200, { unsignedTx }, auth.origin);
  } catch (error) {
    console.error('Build cancel order tx error:', error);
    return jsonResponse(
      500,
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      auth.origin
    );
  }
};
