import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MaestroProvider, UTxO } from '@meshsdk/core';
import { setupE2e } from './e2e/setup';
import { MintingHash } from './e2e/mint/validator';

const getAssetBalanceByUnit = (utxos: UTxO[], unit: string): number => {
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

const getAssetBalanceByNameSuffix = (utxos: UTxO[], assetNameHex: string): number => {
  let total = 0;

  utxos.forEach((utxo) => {
    utxo.output.amount.forEach((asset) => {
      if (asset.unit !== 'lovelace' && asset.unit.endsWith(assetNameHex)) {
        total += Number(asset.quantity);
      }
    });
  });

  return total;
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const address = event.queryStringParameters?.address;

    if (!address) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Address parameter is required' }),
      };
    }

    const maestro = new MaestroProvider({
      network: 'Mainnet',
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

    const { ATRIUM_POOL_STAKE_ASSET_NAME } = setupE2e();
    const atriumStakeUnit = MintingHash + ATRIUM_POOL_STAKE_ASSET_NAME;
    const LADA = Math.max(
      getAssetBalanceByUnit(utxos, atriumStakeUnit),
      getAssetBalanceByNameSuffix(utxos, ATRIUM_POOL_STAKE_ASSET_NAME)
    );

    const tokenBalances = {
      ADA: adaBalance,
      LADA,
    };

    const collateral =
      utxos.find(
        (utxo) =>
          Number(utxo.output.amount[0]?.quantity ?? 0) >= 7_000_000 &&
          utxo.output.amount.length <= 4
      ) ?? null;

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
      },
      body: JSON.stringify({
        balance: adaBalance,
        tokenBalances,
        walletUtxos: utxos,
        collateral,
      }),
    };
  } catch (error) {
    console.error(error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
