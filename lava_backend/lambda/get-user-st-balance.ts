import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MaestroProvider, UTxO, stringToHex } from '@meshsdk/core';
import { jsonResponse, verifyAccessToken } from './security';

const getTokenBalance = (
  utxos: UTxO[],
  policyId: string,
  assetName: string
): number => {
  const assetHex = stringToHex(assetName);
  const unit = policyId + assetHex;

  let total = 0;

  utxos.forEach((utxo) => {
    utxo.output.amount.forEach((asset) => {
      if (asset.unit === unit) {
        total += Number(asset.quantity);
      }
    });
  });

  return total;
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const auth = await verifyAccessToken(event);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const address = auth.address;

    const maestro = new MaestroProvider({
      network: 'Preprod',
      apiKey: process.env.MAESTRO_API_KEY!,
    });

    const utxos = await maestro.fetchAddressUTxOs(address);

    let adaBalance = 0;

    utxos.forEach((utxo) => {
      utxo.output.amount.forEach((asset) => {
        if (asset.unit === 'lovelace') {
          adaBalance += Number(asset.quantity);
        }
      });
    });

    adaBalance /= 1_000_000;

    const test = getTokenBalance(
      utxos,
      "def68337867cb4f1f95b6b811fedbfcdd7780d10a95cc072077088ea",
      "test"
    );

    const stTest = getTokenBalance(
      utxos,
      "9c1dd9791eba86728634ec4d1531ff3f7ace179c3f8b1e75bfbf1906",
      "stTest"
    );

    const tStrike = getTokenBalance(
      utxos,
      "def68337867cb4f1f95b6b811fedbfcdd7780d10a95cc072077088ea",
      "tStrike"
    );

    const LStrike = getTokenBalance(
      utxos,
      "9c1dd9791eba86728634ec4d1531ff3f7ace179c3f8b1e75bfbf1906",
      "LStrike"
    );

    const tPulse = getTokenBalance(
      utxos,
      "def68337867cb4f1f95b6b811fedbfcdd7780d10a95cc072077088ea",
      "tPulse"
    );

    const LPulse = getTokenBalance(
      utxos,
      "9c1dd9791eba86728634ec4d1531ff3f7ace179c3f8b1e75bfbf1906",
      "LPulse"
    );

    const tokenBalances = {
      test,
      stTest,
      tStrike,
      LStrike,
      tPulse,
      LPulse,
    };

    const collateral =
      utxos.find(
        (utxo) =>
          Number(utxo.output.amount[0]?.quantity ?? 0) >= 7_000_000 &&
          utxo.output.amount.length <= 4
      ) ?? null;

    return jsonResponse(
      200,
      {
        balance: adaBalance,
        tokenBalances,
        walletUtxos: utxos,
        collateral,
      },
      auth.origin
    );
  } catch (error) {
    console.error(error);

    return jsonResponse(500, { error: 'Internal server error' }, auth.origin);
  }
};
