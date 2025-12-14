import { MeshTxBuilder } from "@meshsdk/core";
import { BlockchainProviderType } from "../types";
import { batchingTx } from "./batching";
import { setupE2e } from "../setup";
import { MintingHash } from "../mint/validator";

export const batchingTxTest = async (
    blockchainProvider: BlockchainProviderType,
    txBuilder: MeshTxBuilder,
) => {
  const { testUnit, poolStakeAssetName, testAssetName } = setupE2e();

  const poolSAN = poolStakeAssetName;
  const orderAssetName = testAssetName;
  const orderOptInUnit = testUnit;
  const orderOptOutUnit = MintingHash + poolSAN;

  let txHash = await batchingTx(blockchainProvider, txBuilder, poolSAN, orderAssetName, orderOptInUnit, orderOptOutUnit);

  return txHash;
}
