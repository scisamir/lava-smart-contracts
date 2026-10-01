import {
  deserializeDatum,
  mConStr0,
  mConStr1,
  stringToHex,
} from "@meshsdk/core";
import { falseData, trueData } from "../data.js";
import { NETWORK_CONFIG } from "../network.js";
import {
  blockchainProvider,
  botAddress,
  botCollateral,
  botKeyHash,
  botUtxos,
  botWallet,
  txBuilder,
} from "./bot_setup.js";
import {
  GlobalSettingsAddr,
} from "../global_settings/validator.js";
import {
  PoolValidatorAddr,
  PoolValidatorHash,
} from "../pool/validator.js";
import {
  AdminControllerRewardAddress,
  AdminControllerScript,
} from "./validator.js";

const poolScriptTxHash = NETWORK_CONFIG.poolReference.txHash;
const poolScriptTxIdx = NETWORK_CONFIG.poolReference.outputIndex;

const poolStakeAssetName = stringToHex(
  process.env.POOL_STAKE_ASSET_NAME ?? "LADA",
);

const gsUtxo = (
  await blockchainProvider.fetchAddressUTxOs(GlobalSettingsAddr)
)[0];
if (!gsUtxo) {
  throw new Error("Global settings UTxO not found");
}

const poolUtxos = await blockchainProvider.fetchAddressUTxOs(
  PoolValidatorAddr,
);
const matchingPools = poolUtxos.filter((utxo) => {
  if (!utxo.output.plutusData) return false;

  const datum = deserializeDatum<any>(utxo.output.plutusData);
  return datum.fields?.[6]?.bytes === poolStakeAssetName;
});

if (matchingPools.length !== 1) {
  throw new Error(
    `Expected one matching pool UTxO, found ${matchingPools.length}`,
  );
}

const poolUtxo = matchingPools[0];
if (!poolUtxo.output.plutusData) {
  throw new Error("Pool datum not found");
}

const currentPoolDatum = deserializeDatum<any>(poolUtxo.output.plutusData);
if (currentPoolDatum.fields?.length !== 8) {
  throw new Error("Pool uses a different datum schema");
}

const processingStateConstructor = Number(
  currentPoolDatum.fields[7]?.constructor,
);
if (processingStateConstructor !== 0 && processingStateConstructor !== 1) {
  throw new Error("Invalid is_processing_open value");
}

const isProcessingOpen = processingStateConstructor === 1;
const requestedState = process.env.POOL_PROCESSING_STATE
  ?.trim()
  .toLowerCase();
if (requestedState !== "open" && requestedState !== "closed") {
  throw new Error('POOL_PROCESSING_STATE must be "open" or "closed"');
}

const shouldBeOpen = requestedState === "open";
if (isProcessingOpen === shouldBeOpen) {
  console.log(
    `Pool ${process.env.POOL_STAKE_ASSET_NAME ?? "LADA"} is already ${requestedState}`,
  );
  process.exit(0);
}

const updatedPoolDatum = {
  ...currentPoolDatum,
  fields: [
    ...currentPoolDatum.fields.slice(0, 7),
    isProcessingOpen ? falseData() : trueData(),
  ],
};

const unsignedTx = await txBuilder
  .readOnlyTxInReference(gsUtxo.input.txHash, gsUtxo.input.outputIndex)
  .spendingPlutusScriptV3()
  .txIn(
    poolUtxo.input.txHash,
    poolUtxo.input.outputIndex,
    poolUtxo.output.amount,
    poolUtxo.output.address,
  )
  .spendingTxInReference(
    poolScriptTxHash,
    poolScriptTxIdx,
    undefined,
    PoolValidatorHash,
  )
  .spendingReferenceTxInInlineDatumPresent()
  .spendingReferenceTxInRedeemerValue(mConStr1([]))
  .txOut(poolUtxo.output.address, poolUtxo.output.amount)
  .txOutInlineDatumValue(updatedPoolDatum)
  .withdrawalPlutusScriptV3()
  .withdrawal(AdminControllerRewardAddress, "0")
  .withdrawalScript(AdminControllerScript)
  .withdrawalRedeemerValue(mConStr0([]))
  .requiredSignerHash(botKeyHash)
  .txInCollateral(
    botCollateral.input.txHash,
    botCollateral.input.outputIndex,
  )
  .setTotalCollateral("5000000")
  .changeAddress(botAddress)
  .selectUtxosFrom(botUtxos)
  .complete();

const signedTx = await botWallet.signTx(unsignedTx, true);
const txHash = await botWallet.submitTx(signedTx);

console.log("Pool:", process.env.POOL_STAKE_ASSET_NAME ?? "LADA");
console.log("Previous state:", isProcessingOpen ? "open" : "closed");
console.log("New state:", requestedState);
console.log("Toggle pool tx hash:", txHash);
