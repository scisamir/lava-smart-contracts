import { applyParamsToScript, builtinByteString, outputReference, resolveScriptHash, serializePlutusScript } from "@meshsdk/core";
import { blueprint, multisigHash } from "../setup.js";

const gsParamTxHash = "114c2af26b5d0b8e94d4aa0cc4e5000178b45b2dd82c1e2e63021697f47a0054";
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
