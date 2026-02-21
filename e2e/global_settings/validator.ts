import {
  applyParamsToScript,
  builtinByteString,
  outputReference,
  resolveScriptHash,
  serializePlutusScript,
} from "@meshsdk/core";
import { blueprint, multisigHash } from "../setup.js";

const gsParamTxHash =
  "eacb3b737d595e749e50b5d5e5aa5059dd60eb4c4403d46c1af203819be88913";
const gsParamTxIdx = 0;

const GlobalSettingsValidator = blueprint.validators.filter((v) =>
  v.title.includes("global_settings.global_settings.spend"),
);

const GlobalSettingsValidatorScript = applyParamsToScript(
  GlobalSettingsValidator[0].compiledCode,
  [
    builtinByteString(multisigHash),
    outputReference(gsParamTxHash, gsParamTxIdx),
  ],
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
