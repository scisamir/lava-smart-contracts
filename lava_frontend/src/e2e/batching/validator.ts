import { applyParamsToScript, builtinByteString, resolveScriptHash, serializePlutusScript, serializeRewardAddress } from "@meshsdk/core";
import { GlobalSettingsHash } from "../global_settings/validator";
import { PoolValidatorHash } from "../pool/validator";
import { setupE2e } from "../setup";

const { blueprint } = setupE2e();

const BatchingValidator = blueprint.validators.filter(v =>
    v.title.includes("pool_batching.pool_batching.withdraw")
);

const BatchingValidatorScript = applyParamsToScript(
    BatchingValidator[0].compiledCode,
    [
        builtinByteString(GlobalSettingsHash),
        builtinByteString(PoolValidatorHash),
    ],
    "JSON"
);

const BatchingHash = resolveScriptHash(BatchingValidatorScript, "V3");

const BatchingAddr = serializePlutusScript(
    { code: BatchingValidatorScript, version: "V3" },
).address;

const BatchingRewardAddress = serializeRewardAddress(
    BatchingHash,
    true,
    0,
);

export {
    BatchingValidatorScript,
    BatchingHash,
    BatchingAddr,
    BatchingRewardAddress,
}
