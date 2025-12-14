import { MeshTxBuilder } from "@meshsdk/core";
import { BlockchainProviderType } from "../types";
import { batchingTx } from "./batching";
import { setupE2e } from "../setup";
import { MintingHash } from "../mint/validator";

export const batchingTxStrike = async (
    blockchainProvider: BlockchainProviderType,
    txBuilder: MeshTxBuilder,
) => {
  const { tStrikeUnit, tStrikePoolStakeAssetName, tStrikeAssetName } = setupE2e();

  const poolSAN = tStrikePoolStakeAssetName;
  const orderOptInUnit = tStrikeUnit;
  const orderOptOutUnit = MintingHash + poolSAN;
  const orderAssetName = tStrikeAssetName;

  let txHash = await batchingTx(blockchainProvider, txBuilder, poolSAN, orderAssetName, orderOptInUnit, orderOptOutUnit);

  return txHash;
}
