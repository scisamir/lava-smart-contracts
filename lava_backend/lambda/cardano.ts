import { MaestroProvider, MeshTxBuilder } from '@meshsdk/core';
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

export const createMaestroProvider = (apiKey: string): MaestroProvider =>
  new MaestroProvider({
    network: cardanoConfig.maestroNetwork,
    apiKey,
  });

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
