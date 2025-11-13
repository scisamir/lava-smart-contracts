import { applyParamsToScript, builtinByteString, outputReference, resolveScriptHash, serializePlutusScript } from "@meshsdk/core";
import { setupE2e } from "../setup";

const { blueprint, multisigHash } = setupE2e();

const gsParamTxHash = "84b63258348f3b0e132da52df8247309c9e1042ddfdb62e1ec452398b0c21ddd";
const gsParamTxIdx = 1;

const GlobalSettingsValidator = blueprint.validators.filter(v =>
    v.title.includes("global_settings.global_settings.spend")
);

const GlobalSettingsValidatorScript = applyParamsToScript(
    GlobalSettingsValidator[0].compiledCode,
    [
        builtinByteString(multisigHash),
        outputReference(gsParamTxHash, gsParamTxIdx),
    ],
    "JSON"
);

const GlobalSettingsHash = resolveScriptHash(GlobalSettingsValidatorScript, "V3");

const GlobalSettingsAddr = serializePlutusScript(
    { code: GlobalSettingsValidatorScript, version: "V3" },
).address;

export {
    GlobalSettingsValidatorScript,
    GlobalSettingsHash,
    GlobalSettingsAddr,
    gsParamTxHash,
    gsParamTxIdx,
}
