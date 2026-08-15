import { BatchingRewardAddress } from "../batching/validator.js";
import { StakeRewardAddress } from "../stake/validator.js";
import { LAVA_NETWORK } from "../network.js";
import { txBuilder, wallet1, wallet1Address, wallet1Utxos } from "../setup.js";

const rewardAddresses = [BatchingRewardAddress, StakeRewardAddress];

if (LAVA_NETWORK === "mainnet") {
  const [{ AtriumStakeRewardAddress }, { AtriumSwapRewardAddress }] =
    await Promise.all([
      import("../stake_datums/atrium/validator.js"),
      import("../swap_validators/atrium/validator.js"),
    ]);

  rewardAddresses.push(AtriumStakeRewardAddress, AtriumSwapRewardAddress);
}

let tx = txBuilder;
for (const rewardAddress of rewardAddresses) {
  tx = tx.registerStakeCertificate(rewardAddress);
}

const unsignedTx = await tx
  .selectUtxosFrom(wallet1Utxos)
  .changeAddress(wallet1Address)
  .complete();
const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);
console.log("Register stake certificate tx hash:", txHash);
