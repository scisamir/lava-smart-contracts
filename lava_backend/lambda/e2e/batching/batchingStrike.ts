import { MeshTxBuilder } from "@meshsdk/core";
import { BlockchainProviderType } from "../types";
import { batchingTx } from "./batching";
import { setupE2e } from "../setup";

export const batchingTxStrike = async (
  blockchainProvider: BlockchainProviderType,
  txBuilder: MeshTxBuilder
) => {
  const { tStrikePoolStakeAssetName } = setupE2e();
  return batchingTx(blockchainProvider, txBuilder, tStrikePoolStakeAssetName);
};
