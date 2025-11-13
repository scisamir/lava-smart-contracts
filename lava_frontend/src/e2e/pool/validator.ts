import { applyParamsToScript, builtinByteString, resolveScriptHash, serializePlutusScript } from "@meshsdk/core";
import { GlobalSettingsHash } from "../global_settings/validator";
import { setupE2e } from "../setup";

const { blueprint } = setupE2e();

const PoolValidator = blueprint.validators.filter(v =>
    v.title.includes("pool.pool_validator.mint")
);

const PoolValidatorScript = applyParamsToScript(
    PoolValidator[0].compiledCode,
    [
        builtinByteString(GlobalSettingsHash),
    ],
    "JSON"
);

const PoolValidatorHash = resolveScriptHash(PoolValidatorScript, "V3");

const PoolValidatorAddr = serializePlutusScript(
    { code: PoolValidatorScript, version: "V3" },
).address;

export {
    PoolValidatorScript,
    PoolValidatorHash,
    PoolValidatorAddr,
}
