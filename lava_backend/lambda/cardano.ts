import { KoiosProvider, MaestroProvider, MeshTxBuilder, UTxO } from '@meshsdk/core';
import {
  blake2b,
  CborWriter,
  CostModel,
  Costmdls,
  Hash32ByteBase16,
  HexBlob,
  Transaction,
  TxCBOR,
} from '@meshsdk/core-cst';
import networkConfigsJson from '../../config/lava-networks.json';

export type LavaNetwork = 'preprod' | 'mainnet';

type OutputReference = {
  txHash: string;
  outputIndex: number;
};

export type LavaNetworkConfig = {
  networkId: 0 | 1;
  meshNetwork: LavaNetwork;
  maestroNetwork: 'Preprod' | 'Mainnet';
  explorerBaseUrl: string;
  blockfrostBaseUrl: string;
  globalSettingsSeed: OutputReference;
  batchingReference: OutputReference;
  poolReference: OutputReference;
};

const networkConfigs = networkConfigsJson as Record<LavaNetwork, LavaNetworkConfig>;

export const requireLavaNetwork = (
  value = process.env.LAVA_NETWORK,
): LavaNetwork => {
  const network = value?.trim().toLowerCase();

  if (network !== 'preprod' && network !== 'mainnet') {
    throw new Error('LAVA_NETWORK must be either "preprod" or "mainnet"');
  }

  return network;
};

export const lavaNetwork = requireLavaNetwork();
export const cardanoConfig = networkConfigs[lavaNetwork];

export const createMaestroProvider = (apiKey: string): MaestroProvider => {
  const maestro = new MaestroProvider({
    network: cardanoConfig.maestroNetwork,
    apiKey,
  });

  const koiosNetwork = cardanoConfig.meshNetwork === 'mainnet' ? 'api' : 'preprod';
  const koios = new KoiosProvider(koiosNetwork);

  const origFetchAddressUTxOs = maestro.fetchAddressUTxOs.bind(maestro);
  maestro.fetchAddressUTxOs = async (address: string, asset?: string): Promise<UTxO[]> => {
    try {
      const utxos = await origFetchAddressUTxOs(address, asset);
      if (utxos && utxos.length > 0) {
        return utxos;
      }
    } catch (err) {
      console.warn('[cardano] Maestro fetchAddressUTxOs error, falling back to Koios:', err);
    }

    try {
      return await koios.fetchAddressUTxOs(address, asset);
    } catch (err) {
      console.warn('[cardano] Koios fallback fetchAddressUTxOs error:', err);
      return [];
    }
  };

  const origFetchUTxOs = maestro.fetchUTxOs.bind(maestro);
  maestro.fetchUTxOs = async (hash: string, index?: number): Promise<UTxO[]> => {
    try {
      const utxos = await origFetchUTxOs(hash, index);
      if (utxos && utxos.length > 0) {
        return utxos;
      }
    } catch (err) {
      console.warn('[cardano] Maestro fetchUTxOs error, falling back to Koios:', err);
    }

    try {
      return await koios.fetchUTxOs(hash, index);
    } catch (err) {
      console.warn('[cardano] Koios fallback fetchUTxOs error:', err);
      return [];
    }
  };

  const origFetchProtocolParameters = maestro.fetchProtocolParameters.bind(maestro);
  maestro.fetchProtocolParameters = async (epoch?: number) => {
    try {
      return await origFetchProtocolParameters(epoch);
    } catch (err) {
      console.warn('[cardano] Maestro fetchProtocolParameters error, falling back to Koios:', err);
      return await koios.fetchProtocolParameters(epoch);
    }
  };

  const origEvaluateTx = maestro.evaluateTx.bind(maestro);
  maestro.evaluateTx = async (cbor: string, additionalUtxos?: any, additionalTxs?: any) => {
    try {
      return await origEvaluateTx(cbor, additionalUtxos, additionalTxs);
    } catch (err) {
      console.warn('[cardano] Maestro evaluateTx error, falling back to Koios:', err);
      return await koios.evaluateTx(cbor, additionalUtxos, additionalTxs);
    }
  };

  const origSubmitTx = maestro.submitTx.bind(maestro);
  maestro.submitTx = async (tx: string) => {
    try {
      return await origSubmitTx(tx);
    } catch (err) {
      console.warn('[cardano] Maestro submitTx error, falling back to Koios:', err);
      return await koios.submitTx(tx);
    }
  };

  const origFetchTxInfo = maestro.fetchTxInfo.bind(maestro);
  maestro.fetchTxInfo = async (hash: string) => {
    try {
      return await origFetchTxInfo(hash);
    } catch (err) {
      console.warn('[cardano] Maestro fetchTxInfo error, falling back to Koios:', err);
      return await koios.fetchTxInfo(hash);
    }
  };

  const origFetchAccountInfo = maestro.fetchAccountInfo.bind(maestro);
  maestro.fetchAccountInfo = async (address: string) => {
    try {
      return await origFetchAccountInfo(address);
    } catch (err) {
      console.warn('[cardano] Maestro fetchAccountInfo error, falling back to Koios:', err);
      return await koios.fetchAccountInfo(address);
    }
  };

  const origFetchBlockInfo = maestro.fetchBlockInfo.bind(maestro);
  maestro.fetchBlockInfo = async (hash: string) => {
    try {
      return await origFetchBlockInfo(hash);
    } catch (err) {
      console.warn('[cardano] Maestro fetchBlockInfo error, falling back to Koios:', err);
      return await koios.fetchBlockInfo(hash);
    }
  };

  const origGet = maestro.get.bind(maestro);
  maestro.get = async (url: string) => {
    try {
      return await origGet(url);
    } catch (err) {
      console.warn('[cardano] Maestro get error, falling back to Koios:', err);
      return await koios.get(url);
    }
  };

  return maestro;
};

export const formatErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error);
      if (parsed?.data?.message) return parsed.data.message;
      if (parsed?.message) return parsed.message;
      if (parsed?.error) {
        return typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
      }
    } catch {
      // not json
    }
    return error;
  }
  if (error && typeof error === 'object') {
    const obj = error as Record<string, any>;
    if (obj.message) return String(obj.message);
    if (obj.error) {
      return typeof obj.error === 'string' ? obj.error : JSON.stringify(obj.error);
    }
    return JSON.stringify(error);
  }
  return 'Internal server error';
};

export const createMeshTxBuilder = (
  provider: MaestroProvider,
  verbose = false,
): MeshTxBuilder => {
  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    submitter: provider,
    evaluator: provider,
    verbose,
  });

  txBuilder.setNetwork(cardanoConfig.meshNetwork);
  return txBuilder;
};

type PlutusCostModels = {
  PlutusV1?: number[];
  PlutusV2?: number[];
  PlutusV3?: number[];
};

const CBOR_EMPTY_MAP = new Uint8Array([160]);

const normalizeCostModel = (value: unknown): number[] | undefined => {
  if (Array.isArray(value) && value.every((item) => Number.isInteger(item))) {
    return value;
  }

  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const entries = Object.entries(value);
  if (!entries.every(([, item]) => Number.isInteger(item))) {
    return undefined;
  }

  if (entries.every(([key]) => /^\d+$/.test(key))) {
    return entries
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, item]) => Number(item));
  }

  return entries.map(([, item]) => Number(item));
};

const pickCostModel = (
  payload: unknown,
  aliases: string[]
): number[] | undefined => {
  if (typeof payload === 'string') {
    try {
      return pickCostModel(JSON.parse(payload), aliases);
    } catch {
      return undefined;
    }
  }

  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  for (const alias of aliases) {
    const model = normalizeCostModel(record[alias]);
    if (model) {
      return model;
    }
  }

  for (const value of Object.values(record)) {
    const nested = pickCostModel(value, aliases);
    if (nested) {
      return nested;
    }
  }

  return undefined;
};

const extractCostModels = (payload: unknown): PlutusCostModels => ({
  PlutusV1: pickCostModel(payload, [
    'PlutusV1',
    'plutus_v1',
    'plutusv1',
    'plutusV1',
    'costModelsPlutusV1',
    'v1',
  ]),
  PlutusV2: pickCostModel(payload, [
    'PlutusV2',
    'plutus_v2',
    'plutusv2',
    'plutusV2',
    'costModelsPlutusV2',
    'v2',
  ]),
  PlutusV3: pickCostModel(payload, [
    'PlutusV3',
    'plutus_v3',
    'plutusv3',
    'plutusV3',
    'costModelsPlutusV3',
    'v3',
  ]),
});

const fetchJson = async (
  url: string,
  headers?: Record<string, string>
): Promise<unknown> => {
  const response = await fetch(url, { headers });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${body.slice(0, 200)}`);
  }

  return JSON.parse(body);
};

const fetchCurrentCostModels = async (maestroApiKey?: string): Promise<PlutusCostModels> => {
  const maestroBaseUrl = `https://${cardanoConfig.maestroNetwork.toLowerCase()}.gomaestro-api.org/v1`;
  const headers = maestroApiKey ? { 'api-key': maestroApiKey } : undefined;

  for (const endpoint of ['protocol-parameters', 'protocol-params']) {
    try {
      const payload = await fetchJson(`${maestroBaseUrl}/${endpoint}`, headers);
      const models = extractCostModels(payload);
      if (models.PlutusV3) {
        return models;
      }
    } catch (error) {
      console.warn(`Unable to fetch Maestro ${endpoint}:`, error);
    }
  }

  const koiosHost =
    lavaNetwork === 'preprod'
      ? 'https://preprod.koios.rest'
      : 'https://api.koios.rest';
  const koiosPayload = await fetchJson(
    `${koiosHost}/api/v1/cli_protocol_params`,
    { accept: 'application/json' }
  );
  const models = extractCostModels(koiosPayload);

  if (!models.PlutusV3) {
    throw new Error('Unable to resolve live Plutus V3 cost model');
  }

  return models;
};

const hasItems = (value: { size: () => number } | undefined): boolean =>
  Boolean(value && value.size() > 0);

const buildCostmdls = (witnessSet: ReturnType<Transaction['witnessSet']>, models: PlutusCostModels): Costmdls => {
  const costmdls = new Costmdls();
  const hasV1 = hasItems(witnessSet.plutusV1Scripts());
  const hasV2 = hasItems(witnessSet.plutusV2Scripts());
  const hasV3 = hasItems(witnessSet.plutusV3Scripts());

  if (hasV1 && models.PlutusV1) {
    costmdls.insert(CostModel.newPlutusV1(models.PlutusV1));
  }
  if (hasV2 && models.PlutusV2) {
    costmdls.insert(CostModel.newPlutusV2(models.PlutusV2));
  }
  if ((hasV3 || (!hasV1 && !hasV2)) && models.PlutusV3) {
    costmdls.insert(CostModel.newPlutusV3(models.PlutusV3));
  }

  return costmdls;
};

const computeScriptDataHash = (
  costModels: Costmdls,
  redeemers: ReturnType<ReturnType<Transaction['witnessSet']>['redeemers']>,
  datums: ReturnType<ReturnType<Transaction['witnessSet']>['plutusData']>
): string | undefined => {
  const writer = new CborWriter();

  if (datums && datums.size() > 0 && (!redeemers || redeemers.size() === 0)) {
    writer.writeEncodedValue(CBOR_EMPTY_MAP);
    writer.writeEncodedValue(Buffer.from(datums.toCbor(), 'hex'));
    writer.writeEncodedValue(CBOR_EMPTY_MAP);
  } else {
    if (!redeemers || redeemers.size() === 0) {
      return undefined;
    }

    writer.writeEncodedValue(Buffer.from(redeemers.toCbor(), 'hex'));
    if (datums && datums.size() > 0) {
      writer.writeEncodedValue(Buffer.from(datums.toCbor(), 'hex'));
    }
    writer.writeEncodedValue(Buffer.from(costModels.languageViewsEncoding(), 'hex'));
  }

  return blake2b.hash(
    HexBlob(Buffer.from(writer.encode()).toString('hex')),
    32
  );
};

export const applyLiveProtocolParams = async (
  txBuilder: MeshTxBuilder,
  provider: MaestroProvider
): Promise<void> => {
  try {
    txBuilder.protocolParams(await provider.fetchProtocolParameters());
  } catch (error) {
    console.warn('Unable to fetch live protocol parameters:', error);
  }
};

export const repairScriptIntegrityHash = async (
  txHex: string,
  maestroApiKey?: string
): Promise<string> => {
  const tx = Transaction.fromCbor(TxCBOR(txHex));
  const witnessSet = tx.witnessSet();
  const redeemers = witnessSet.redeemers();

  if (!redeemers || redeemers.size() === 0) {
    return txHex;
  }

  const models = await fetchCurrentCostModels(maestroApiKey);
  const scriptDataHash = computeScriptDataHash(
    buildCostmdls(witnessSet, models),
    redeemers,
    witnessSet.plutusData()
  );

  if (!scriptDataHash) {
    return txHex;
  }

  const body = tx.body();
  body.setScriptDataHash(Hash32ByteBase16(scriptDataHash));
  tx.setBody(body);

  return tx.toCbor();
};
