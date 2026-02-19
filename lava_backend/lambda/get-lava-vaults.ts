import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MaestroProvider, deserializeDatum, hexToString, applyParamsToScript, builtinByteString, resolveScriptHash, serializePlutusScript, NativeScript, resolveNativeScriptHash, serializeNativeScript, outputReference } from '@meshsdk/core';
import blueprint from '../plutus.json';

// Compute PoolValidatorAddr
const wallet1VK = "96cbb27c96daf8cab890de6d7f87f5ffd025bf8ac80717cbc4fae7da";
const wallet2VK = "331da30f7c8fea429e2bdc161efde817cbb06f78a53ef5ceee42c9a3";

const nativeScript: NativeScript = {
  type: "all",
  scripts: [
    { type: "sig", keyHash: wallet1VK },
    { type: "sig", keyHash: wallet2VK },
  ],
};
const multisigHash = resolveNativeScriptHash(nativeScript);

const gsParamTxHash = "a65532a96c8c1ab316f4f6e9bfdf01f04d8b1750f3269ecf74a8e8fe04279bea";
const gsParamTxIdx = 1;

const GlobalSettingsValidator = blueprint.validators.filter(v =>
  v.title.includes("global_settings.global_settings.spend")
);

const GlobalSettingsValidatorScript = applyParamsToScript(
  GlobalSettingsValidator[0].compiledCode,
  [
    builtinByteString(multisigHash),
    outputReference(gsParamTxHash, gsParamTxIdx),
  ],
  "JSON"
);

const GlobalSettingsHash = resolveScriptHash(GlobalSettingsValidatorScript, "V3");

const PoolValidator = blueprint.validators.filter(v =>
  v.title.includes("pool.pool_validator.mint")
);

const PoolValidatorScript = applyParamsToScript(
  PoolValidator[0].compiledCode,
  [builtinByteString(GlobalSettingsHash)],
  "JSON"
);

const PoolValidatorAddr = serializePlutusScript(
  { code: PoolValidatorScript, version: "V3" }
).address;

type PoolDatumType = any;

const TOKEN_PAIRS = [
  { base: "test", derivative: "stTest" },
  { base: "tStrike", derivative: "LStrike" },
  { base: "tPulse", derivative: "LPulse" },
];

const LOGOS = [
  "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=128&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=128&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=128&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=128&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1642052502435-0f5d128a4d2f?w=128&q=80&auto=format&fit=crop",
];

const getRandomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const getRandomLogo = (): string => LOGOS[getRandomInt(0, LOGOS.length - 1)];

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const maestro = new MaestroProvider({
      network: 'Preprod',
      apiKey: process.env.MAESTRO_API_KEY!,
    });

    console.log("Fetching UTXOs for address:", PoolValidatorAddr);
    const utxos = await maestro.fetchAddressUTxOs(PoolValidatorAddr);
    console.log("Fetched UTXOs count:", utxos.length);
    const vaults: any[] = [];

    for (const utxo of utxos) {
      if (utxo.output.plutusData) {
        const poolDatum = deserializeDatum<PoolDatumType>(
          utxo.output.plutusData
        );

        const name = hexToString(poolDatum.fields[6].bytes);
        const isPoolOpen = poolDatum.fields[7].constructor === 1;
        const totalUnderlying = Number(poolDatum.fields[2].int);
        const totalStAssetsMinted = Number(poolDatum.fields[1].int);

        const tokenPair =
          TOKEN_PAIRS.find((p) => p.derivative === name) ||
          { base: "", derivative: "" };

        const score = (Math.random() * 30 + 70).toFixed(2);
        const recentBlocks = getRandomInt(100, 1200);

        vaults.push({
          name,
          logo: getRandomLogo(),
          score,
          status: isPoolOpen ? "Open" : "Closed",
          recentBlocks,
          stStake: totalStAssetsMinted.toLocaleString(),
          staked: totalUnderlying.toLocaleString(),
          tokenPair,
        });
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
      },
      body: JSON.stringify({ vaults }),
    };
  } catch (error) {
    console.error(error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
