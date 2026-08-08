import {
  applyParamsToScript,
  outputReference,
  resolveScriptHash,
  serializePlutusScript,
} from "@meshsdk/core";
import { setupE2e } from "../setup";

const { blueprint, NETWORK_ID } = setupE2e();
const networkId = NETWORK_ID as 0 | 1;

const gsParamTxHash =
  "9d225cd31ee8b47b9782a2b1a9308a02d129f919e562dd492d4accb5b25311ab";
const gsParamTxIdx = 4;

const GlobalSettingsValidator = blueprint.validators.filter((v: any) =>
  v.title.includes("global_settings.global_settings.spend")
);

const GlobalSettingsValidatorScript = applyParamsToScript(
  GlobalSettingsValidator[0].compiledCode,
  [outputReference(gsParamTxHash, gsParamTxIdx)],
  "JSON"
);

const GlobalSettingsHash = resolveScriptHash(GlobalSettingsValidatorScript, "V3");

const GlobalSettingsAddr = serializePlutusScript(
  {
    code: GlobalSettingsValidatorScript,
    version: "V3",
  },
  undefined,
  networkId,
  undefined,
).address;

export {
  GlobalSettingsValidatorScript,
  GlobalSettingsHash,
  GlobalSettingsAddr,
  gsParamTxHash,
  gsParamTxIdx,
};
