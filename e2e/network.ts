import "dotenv/config";

import networkConfigs from "../config/lava-networks.json" with {
  type: "json",
};

export type LavaNetwork = "preprod" | "mainnet";

type NetworkConfig = {
  networkId: 0 | 1;
  meshNetwork: LavaNetwork;
  maestroNetwork: "Preprod" | "Mainnet";
  explorerBaseUrl: string;
  blockfrostBaseUrl: string;
  globalSettingsSeed: {
    txHash: string;
    outputIndex: number;
  };
  batchingReference: {
    txHash: string;
    outputIndex: number;
  };
  poolReference: {
    txHash: string;
    outputIndex: number;
  };
};

const isLavaNetwork = (value: string | undefined): value is LavaNetwork =>
  value === "preprod" || value === "mainnet";

const configuredNetwork = process.env.LAVA_NETWORK?.trim().toLowerCase();

if (!isLavaNetwork(configuredNetwork)) {
  throw new Error(
    'LAVA_NETWORK must be set to either "preprod" or "mainnet".',
  );
}

const configs = networkConfigs as Record<LavaNetwork, NetworkConfig>;

export const LAVA_NETWORK = configuredNetwork;
export const NETWORK_CONFIG = configs[LAVA_NETWORK];
export const NETWORK_ID = NETWORK_CONFIG.networkId;

export const requireLavaNetwork = (
  requiredNetwork: LavaNetwork,
  feature: string,
): void => {
  if (LAVA_NETWORK !== requiredNetwork) {
    throw new Error(
      `${feature} requires LAVA_NETWORK=${requiredNetwork} (got ${LAVA_NETWORK})`,
    );
  }
};
