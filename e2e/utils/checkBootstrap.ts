import { BatchingHash } from "../batching/validator.js";
import {
  GlobalSettingsAddr,
  GlobalSettingsHash,
  gsParamTxHash,
  gsParamTxIdx,
} from "../global_settings/validator.js";
import { PoolValidatorHash } from "../pool/validator.js";
import { LAVA_NETWORK, blockchainProvider } from "../setup.js";

const [seedOutput] = await blockchainProvider.fetchUTxOs(
  gsParamTxHash,
  gsParamTxIdx,
);
if (!seedOutput) {
  throw new Error(
    `Global settings seed output not found: ${gsParamTxHash}#${gsParamTxIdx}`,
  );
}

const liveSeedUtxos = await blockchainProvider.fetchAddressUTxOs(
  seedOutput.output.address,
);
const seedUtxo = liveSeedUtxos.find(
  (utxo) =>
    utxo.input.txHash === gsParamTxHash &&
    utxo.input.outputIndex === gsParamTxIdx,
);
if (!seedUtxo) {
  throw new Error(
    `Global settings seed UTxO is already spent: ${gsParamTxHash}#${gsParamTxIdx}`,
  );
}

const globalSettingsUtxos =
  await blockchainProvider.fetchAddressUTxOs(GlobalSettingsAddr);
if (globalSettingsUtxos.length > 0) {
  throw new Error(
    `Global settings already exists at ${GlobalSettingsAddr}. Do not run create_gs.ts again.`,
  );
}

console.log("Network:", LAVA_NETWORK);
console.log("Global settings seed:", `${gsParamTxHash}#${gsParamTxIdx}`);
console.log("Global settings hash:", GlobalSettingsHash);
console.log("Pool validator hash:", PoolValidatorHash);
console.log("Batching validator hash:", BatchingHash);
console.log("Bootstrap check passed");
