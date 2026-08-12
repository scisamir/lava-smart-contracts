import {
  applyParamsToScript,
  outputReference,
  resolveScriptHash,
  serializePlutusScript,
} from "@meshsdk/core";
import { blueprint, NETWORK_ID } from "../setup.js";
import { NETWORK_CONFIG } from "../network.js";

const gsParamTxHash = NETWORK_CONFIG.globalSettingsSeed.txHash;
const gsParamTxIdx = NETWORK_CONFIG.globalSettingsSeed.outputIndex;

const GlobalSettingsValidator = blueprint.validators.filter((v) =>
  v.title.includes("global_settings.global_settings.spend"),
);

const GlobalSettingsValidatorScript = applyParamsToScript(
  GlobalSettingsValidator[0].compiledCode,
  [outputReference(gsParamTxHash, gsParamTxIdx)],
  "JSON",
);

const GlobalSettingsHash = resolveScriptHash(
  GlobalSettingsValidatorScript,
  "V3",
);

const GlobalSettingsAddr = serializePlutusScript(
  {
    code: GlobalSettingsValidatorScript,
    version: "V3",
  },
  undefined,
  NETWORK_ID,
  undefined,
).address;

export {
  GlobalSettingsValidatorScript,
  GlobalSettingsHash,
  GlobalSettingsAddr,
  gsParamTxHash,
  gsParamTxIdx,
};
