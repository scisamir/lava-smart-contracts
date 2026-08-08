import { BatchingRewardAddress } from "../batching/validator.js";
import { StakeRewardAddress } from "../stake/validator.js";
import { AtriumStakeRewardAddress } from "../stake_datums/atrium/validator.js";
import { AtriumSwapRewardAddress } from "../swap_validators/atrium/validator.js";
import { txBuilder, wallet1, wallet1Address, wallet1Utxos } from "../setup.js";

// withdraw zero setup (register all stake cert)
const unsignedTx = await txBuilder
  .registerStakeCertificate(BatchingRewardAddress)
  .registerStakeCertificate(StakeRewardAddress)
  .registerStakeCertificate(AtriumStakeRewardAddress)
  .registerStakeCertificate(AtriumSwapRewardAddress)
  .selectUtxosFrom(wallet1Utxos)
  .changeAddress(wallet1Address)
  .complete();
const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);
console.log("register all stake certificate tx hash:", txHash);
