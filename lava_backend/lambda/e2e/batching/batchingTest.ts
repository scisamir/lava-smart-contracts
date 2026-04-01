import { MeshTxBuilder } from "@meshsdk/core";
import { BlockchainProviderType } from "../types";
import { batchingTx } from "./batching";
import { setupE2e } from "../setup";

export const batchingTxTest = async (
  blockchainProvider: BlockchainProviderType,
  txBuilder: MeshTxBuilder
) => {
  const { poolStakeAssetName } = setupE2e();
  return batchingTx(blockchainProvider, txBuilder, poolStakeAssetName);
};
