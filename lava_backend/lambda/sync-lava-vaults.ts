import { ScheduledEvent } from 'aws-lambda';
import {
  MaestroProvider,
  deserializeDatum,
  hexToString,
  applyParamsToScript,
  builtinByteString,
  resolveScriptHash,
  serializePlutusScript,
  NativeScript,
  resolveNativeScriptHash,
  outputReference,
} from '@meshsdk/core';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import blueprint from '../../smart_contract/plutus.json';
import { setupE2e } from './e2e/setup';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

type PoolDatumType = any;

type TokenMetadataItem = {
  pk: string;
  sk: string;
  entityType: 'TOKEN_METADATA';
  symbol: string;
  displayName?: string;
  policyId?: string;
  assetNameHex?: string;
  decimals?: number;
  logo?: string;
  underlyingSymbol?: string;
  underlyingDisplayName?: string;
  underlyingPolicyId?: string;
  underlyingAssetNameHex?: string;
  underlyingDecimals?: number;
  underlyingLogo?: string;
  isActive?: boolean;
};

const wallet1VK = '96cbb27c96daf8cab890de6d7f87f5ffd025bf8ac80717cbc4fae7da';
const wallet2VK = '331da30f7c8fea429e2bdc161efde817cbb06f78a53ef5ceee42c9a3';

const nativeScript: NativeScript = {
  type: 'all',
  scripts: [
    { type: 'sig', keyHash: wallet1VK },
    { type: 'sig', keyHash: wallet2VK },
  ],
};
const multisigHash = resolveNativeScriptHash(nativeScript);

const gsParamTxHash = 'a65532a96c8c1ab316f4f6e9bfdf01f04d8b1750f3269ecf74a8e8fe04279bea';
const gsParamTxIdx = 1;

const GlobalSettingsValidator = blueprint.validators.filter(v =>
  v.title.includes('global_settings.global_settings.spend')
);

const GlobalSettingsValidatorScript = applyParamsToScript(
  GlobalSettingsValidator[0].compiledCode,
  [
    builtinByteString(multisigHash),
    outputReference(gsParamTxHash, gsParamTxIdx),
  ],
  'JSON'
);

const GlobalSettingsHash = resolveScriptHash(GlobalSettingsValidatorScript, 'V3');

const PoolValidator = blueprint.validators.filter(v =>
  v.title.includes('pool.pool_validator.mint')
);

const PoolValidatorScript = applyParamsToScript(
  PoolValidator[0].compiledCode,
  [builtinByteString(GlobalSettingsHash)],
  'JSON'
);

const PoolValidatorAddr = serializePlutusScript(
  { code: PoolValidatorScript, version: 'V3' }
).address;

const LOGOS = [
  'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=128&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=128&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=128&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=128&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1642052502435-0f5d128a4d2f?w=128&q=80&auto=format&fit=crop',
];

const getRandomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const getRandomLogo = (): string => LOGOS[getRandomInt(0, LOGOS.length - 1)];

const loadTokenRegistry = async (tableName: string) => {
  const scanResult = await ddb.send(
    new ScanCommand({
      TableName: tableName,
      FilterExpression: '#entityType = :entityType',
      ExpressionAttributeNames: {
        '#entityType': 'entityType',
      },
      ExpressionAttributeValues: {
        ':entityType': 'TOKEN_METADATA',
      },
    })
  );

  const tokenItems = (scanResult.Items ?? []) as TokenMetadataItem[];
  const activeItems = tokenItems.filter(item => item.isActive !== false);

  return new Map<string, TokenMetadataItem>(
    activeItems.map(item => [item.symbol, item])
  );
};

export const handler = async (_event: ScheduledEvent): Promise<{ statusCode: number; body: string }> => {
  try {
    const { ATRIUM_POOL_STAKE_ASSET_NAME } = setupE2e();

    const maestroApiKey = process.env.MAESTRO_API_KEY;
    const tableName = process.env.TABLE_NAME;

    if (!maestroApiKey) {
      throw new Error('MAESTRO_API_KEY is not configured');
    }
    if (!tableName) {
      throw new Error('TABLE_NAME is not configured');
    }

    const maestro = new MaestroProvider({
      network: 'Mainnet',
      apiKey: maestroApiKey,
    });

    const tokenRegistry = await loadTokenRegistry(tableName);
    const utxos = await maestro.fetchAddressUTxOs(PoolValidatorAddr);

    const nowIso = new Date().toISOString();
    let syncedCount = 0;
    const seenVaultPks = new Set<string>();

    for (const utxo of utxos) {
      if (!utxo.output.plutusData) {
        continue;
      }

      const poolDatum = deserializeDatum<PoolDatumType>(utxo.output.plutusData);

      const derivativeSymbol = hexToString(poolDatum.fields[6].bytes);
      const poolStakeAssetNameHex = String(poolDatum.fields[6].bytes ?? '');

      if (poolStakeAssetNameHex !== ATRIUM_POOL_STAKE_ASSET_NAME) {
        continue;
      }

      const isPoolOpen = poolDatum.fields[7].constructor === 1;
      const totalUnderlying = Number(poolDatum.fields[2].int);
      const totalStAssetsMinted = Number(poolDatum.fields[1].int);
      const underlyingPolicyId = String(poolDatum.fields[5].fields[1].bytes ?? '');
      const underlyingAssetNameHex = String(poolDatum.fields[5].fields[2].bytes ?? '');
      const isUnderlyingAda = underlyingPolicyId === '' && underlyingAssetNameHex === '';

      const tokenMeta = tokenRegistry.get(derivativeSymbol);
      const baseSymbol = tokenMeta?.underlyingSymbol ?? (isUnderlyingAda ? 'ADA' : '');

      const vaultPk = `VAULT#${derivativeSymbol}`;
      seenVaultPks.add(vaultPk);

      const vaultItem = {
        pk: vaultPk,
        sk: 'SNAPSHOT',
        entityType: 'VAULT_SNAPSHOT',
        name: derivativeSymbol,
        logo: tokenMeta?.logo ?? getRandomLogo(),
        score: (Math.random() * 30 + 70).toFixed(2),
        status: isPoolOpen ? 'Open' : 'Closed',
        recentBlocks: getRandomInt(100, 1200),
        stStake: totalStAssetsMinted.toLocaleString(),
        staked: totalUnderlying.toLocaleString(),
        tokenPair: {
          base: baseSymbol,
          derivative: derivativeSymbol,
        },
        poolStakeAssetNameHex,
        tokenDetails: {
          derivative: {
            symbol: derivativeSymbol,
            displayName: tokenMeta?.displayName ?? derivativeSymbol,
            policyId: tokenMeta?.policyId ?? '',
            assetNameHex: tokenMeta?.assetNameHex ?? '',
            decimals: Number(tokenMeta?.decimals ?? 0),
            logo: tokenMeta?.logo ?? '',
          },
          base: {
            symbol: baseSymbol,
            displayName: tokenMeta?.underlyingDisplayName ?? baseSymbol,
            policyId: tokenMeta?.underlyingPolicyId ?? '',
            assetNameHex: tokenMeta?.underlyingAssetNameHex ?? '',
            decimals: Number(tokenMeta?.underlyingDecimals ?? 0),
            logo: tokenMeta?.underlyingLogo ?? '',
          },
        },
        onchain: {
          totalUnderlyingRaw: String(totalUnderlying),
          totalStAssetsMintedRaw: String(totalStAssetsMinted),
          txHash: utxo.input.txHash,
          outputIndex: utxo.input.outputIndex,
        },
        updatedAt: nowIso,
      };

      await ddb.send(
        new PutCommand({
          TableName: tableName,
          Item: vaultItem,
        })
      );

      syncedCount++;
    }

    const existingSnapshots = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: '#entityType = :entityType',
        ExpressionAttributeNames: { '#entityType': 'entityType' },
        ExpressionAttributeValues: { ':entityType': 'VAULT_SNAPSHOT' },
      })
    );

    const staleItems = (existingSnapshots.Items ?? []).filter((item) => {
      const pk = String(item.pk ?? '');
      const sk = String(item.sk ?? '');
      return pk.startsWith('VAULT#') && sk === 'SNAPSHOT' && !seenVaultPks.has(pk);
    });

    for (const staleItem of staleItems) {
      await ddb.send(
        new DeleteCommand({
          TableName: tableName,
          Key: {
            pk: staleItem.pk,
            sk: staleItem.sk,
          },
        })
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Vault sync completed',
        syncedCount,
        updatedAt: nowIso,
      }),
    };
  } catch (error) {
    console.error('sync-lava-vaults failed', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Vault sync failed' }),
    };
  }
};
