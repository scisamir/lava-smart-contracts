export type LavaNetwork = "preprod" | "mainnet";

type NetworkConfig = {
  name: LavaNetwork;
  label: "Preprod" | "Mainnet";
  networkId: 0 | 1;
  explorerBaseUrl: string;
};

const NETWORKS: Record<LavaNetwork, NetworkConfig> = {
  preprod: {
    name: "preprod",
    label: "Preprod",
    networkId: 0,
    explorerBaseUrl: "https://preprod.cardanoscan.io",
  },
  mainnet: {
    name: "mainnet",
    label: "Mainnet",
    networkId: 1,
    explorerBaseUrl: "https://cardanoscan.io",
  },
};

const rawNetwork = process.env.LAVA_NETWORK?.trim();
const configuredNetwork: LavaNetwork =
  rawNetwork === "mainnet" ? "mainnet" : "preprod";

export const networkConfig = NETWORKS[configuredNetwork];

export const getTransactionExplorerUrl = (txHash: string): string =>
  `${networkConfig.explorerBaseUrl}/transaction/${encodeURIComponent(txHash)}`;
