import { applyParamsToScript, builtinByteString, conStr, resolveScriptHash, serializePlutusScript } from "@meshsdk/core";
import { setupE2e } from "../setup";
import { GlobalSettingsHash } from "../global_settings/validator";
import { BatchingHash } from "../batching/validator";

const { blueprint } = setupE2e();

const MintingValidator = blueprint.validators.filter(v => 
    v.title.includes("minting.minting.mint")
);

const MintingValidatorScript = applyParamsToScript(
    MintingValidator[0].compiledCode,
    [
      conStr(1, [builtinByteString(BatchingHash)]),
      builtinByteString(GlobalSettingsHash),
    ],
    "JSON"
);

const MintingHash = resolveScriptHash(MintingValidatorScript, "V3");

const MintingAddr = serializePlutusScript(
    { code: MintingValidatorScript, version: "V3" },
).address;

export {
    MintingValidatorScript,
    MintingHash,
    MintingAddr,
}
