import {
  applyParamsToScript,
  outputReference,
  resolveScriptHash,
  serializePlutusScript,
} from "@meshsdk/core";
import { blueprint } from "../setup.js";

const gsParamTxHash =
  "dcba2c8882e6b5f4980f871ec8af4b18abf8ba07f6387c7478625fdefd4d33da";
const gsParamTxIdx = 1;

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

const GlobalSettingsAddr = serializePlutusScript({
  code: GlobalSettingsValidatorScript,
  version: "V3",
}).address;

export {
  GlobalSettingsValidatorScript,
  GlobalSettingsHash,
  GlobalSettingsAddr,
  gsParamTxHash,
  gsParamTxIdx,
};
