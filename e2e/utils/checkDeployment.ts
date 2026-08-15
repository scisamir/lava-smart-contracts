import { deserializeDatum } from "@meshsdk/core";
import { BatchingHash } from "../batching/validator.js";
import {
  GlobalSettingsAddr,
  GlobalSettingsHash,
} from "../global_settings/validator.js";
import { PoolValidatorAddr, PoolValidatorHash } from "../pool/validator.js";
import {
  GlobalSettingsNft,
  LAVA_NETWORK,
  batchingScriptTxHash,
  batchingScriptTxIdx,
  blockchainProvider,
  poolScriptTxHash,
  poolScriptTxIdx,
} from "../setup.js";

const issues: string[] = [];

const checkReferenceScript = async (
  label: string,
  txHash: string,
  outputIndex: number,
  expectedHash: string,
): Promise<void> => {
  const [utxo] = await blockchainProvider.fetchUTxOs(txHash, outputIndex);

  if (!utxo) {
    issues.push(
      `${label} reference UTxO not found: ${txHash}#${outputIndex}`,
    );
    return;
  }

  const liveUtxos = await blockchainProvider.fetchAddressUTxOs(
    utxo.output.address,
  );
  const liveUtxo = liveUtxos.find(
    (item) =>
      item.input.txHash === txHash && item.input.outputIndex === outputIndex,
  );
  if (!liveUtxo) {
    issues.push(`${label} reference UTxO is already spent`);
    return;
  }

  if (!liveUtxo.output.scriptRef || !liveUtxo.output.scriptHash) {
    issues.push(`${label} reference UTxO does not contain a reference script`);
    return;
  }

  if (liveUtxo.output.scriptHash !== expectedHash) {
    issues.push(
      `${label} reference script is stale. Expected ${expectedHash}, found ${liveUtxo.output.scriptHash}`,
    );
  }
};

await checkReferenceScript(
  "Pool",
  poolScriptTxHash,
  poolScriptTxIdx,
  PoolValidatorHash,
);
await checkReferenceScript(
  "Batching",
  batchingScriptTxHash,
  batchingScriptTxIdx,
  BatchingHash,
);

const globalSettingsUtxos =
  await blockchainProvider.fetchAddressUTxOs(GlobalSettingsAddr);
if (globalSettingsUtxos.length !== 1) {
  issues.push(
    `Expected one global settings UTxO, found ${globalSettingsUtxos.length}`,
  );
}

const [globalSettingsUtxo] = globalSettingsUtxos;
if (globalSettingsUtxo) {
  if (!globalSettingsUtxo.output.plutusData) {
    issues.push("Global settings datum not found");
  } else {
    const globalSettings = deserializeDatum<any>(
      globalSettingsUtxo.output.plutusData,
    );
    if (globalSettings.fields?.length !== 9) {
      issues.push(
        `Expected the 9-field GlobalSettingsDatum, found ${globalSettings.fields?.length ?? 0} fields`,
      );
    }
  }

  const globalSettingsUnit = GlobalSettingsHash + GlobalSettingsNft;
  const globalSettingsNft = globalSettingsUtxo.output.amount.find(
    (asset) => asset.unit === globalSettingsUnit,
  );
  if (globalSettingsNft?.quantity !== "1") {
    issues.push("Global settings UTxO does not contain exactly one GSN");
  }
}

const poolUtxos = await blockchainProvider.fetchAddressUTxOs(PoolValidatorAddr);
if (poolUtxos.length === 0) {
  issues.push("No pool UTxO found at the current pool validator address");
}

console.log("Network:", LAVA_NETWORK);
console.log("Global settings hash:", GlobalSettingsHash);
console.log("Pool validator hash:", PoolValidatorHash);
console.log("Batching validator hash:", BatchingHash);
console.log("Pool UTxOs:", poolUtxos.length);

if (issues.length > 0) {
  throw new Error(`Deployment check failed:\n- ${issues.join("\n- ")}`);
}

console.log("Deployment check passed");
