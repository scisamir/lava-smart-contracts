import { MeshTxBuilder } from "@meshsdk/core";
import { BlockchainProviderType } from "../types";
import { batchingTx } from "./batching";
import { setupE2e } from "../setup";

export const batchingTxPulse = async (
  blockchainProvider: BlockchainProviderType,
  txBuilder: MeshTxBuilder
) => {
  const { tPulsePoolStakeAssetName } = setupE2e();
  return batchingTx(blockchainProvider, txBuilder, tPulsePoolStakeAssetName);
};
