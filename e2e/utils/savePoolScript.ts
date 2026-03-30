import {
  applyCborEncoding,
  resolveScriptHash,
  serializePlutusScript,
} from "@meshsdk/core";
import {
  blockchainProvider,
  txBuilder,
  wallet1,
  wallet1Address,
  wallet1Utxos,
  requireWallet1Collateral,
  NETWORK_ID,
} from "../setup.js";
import { PoolValidatorScript } from "../pool/validator.js";

const wallet1Collateral = requireWallet1Collateral();

const refScript = applyCborEncoding(
  "5857010100323232323225333002323232323253330073370e900118041baa00113233224a060160026016601800260126ea800458c024c02800cc020008c01c008c01c004c010dd50008a4c26cacae6955ceaab9e5742ae89",
);
const refAddress = serializePlutusScript(
  {
    code: refScript,
    version: "V3",
  },
  undefined,
  NETWORK_ID,
  undefined,
).address;

const unsignedTx = await txBuilder
  .txOut(refAddress, [])
  .txOutReferenceScript(PoolValidatorScript, "V3")
  .changeAddress(wallet1Address)
  .selectUtxosFrom(wallet1Utxos)
  .txInCollateral(
    wallet1Collateral.input.txHash,
    wallet1Collateral.input.outputIndex,
    wallet1Collateral.output.amount,
    wallet1Collateral.output.address,
  )
  .complete();

const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);

console.log("save pool script tx Hash:", txHash);
