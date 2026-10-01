import {
  botAddress,
  botUtxos,
  botWallet,
  txBuilder,
} from "./bot_setup.js";
import {
  AdminControllerHash,
  AdminControllerRewardAddress,
} from "./validator.js";

const unsignedTx = await txBuilder
  .registerStakeCertificate(AdminControllerRewardAddress)
  .selectUtxosFrom(botUtxos)
  .changeAddress(botAddress)
  .complete();

const signedTx = await botWallet.signTx(unsignedTx);
const txHash = await botWallet.submitTx(signedTx);

console.log("Admin controller hash:", AdminControllerHash);
console.log("Admin controller reward address:", AdminControllerRewardAddress);
console.log("Register admin controller tx hash:", txHash);
