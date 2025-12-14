import { MeshTxBuilder } from "@meshsdk/core";
import { BlockchainProviderType } from "../types";
import { batchingTx } from "./batching";
import { setupE2e } from "../setup";
import { MintingHash } from "../mint/validator";

export const batchingTxPulse = async (
    blockchainProvider: BlockchainProviderType,
    txBuilder: MeshTxBuilder,
) => {
  const { tPulseUnit, tPulsePoolStakeAssetName, tPulseAssetName } = setupE2e();

  const poolSAN = tPulsePoolStakeAssetName;
  const orderOptInUnit = tPulseUnit;
  const orderOptOutUnit = MintingHash + poolSAN;
  const orderAssetName = tPulseAssetName;

  let txHash = await batchingTx(blockchainProvider, txBuilder, poolSAN, orderAssetName, orderOptInUnit, orderOptOutUnit);

  return txHash;
}
