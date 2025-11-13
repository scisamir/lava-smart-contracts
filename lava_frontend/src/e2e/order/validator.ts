import { applyParamsToScript, builtinByteString, conStr, resolveScriptHash, serializePlutusScript, serializeRewardAddress } from "@meshsdk/core";
import { setupE2e } from "../setup";
import { BatchingHash } from "../batching/validator";

const { blueprint } = setupE2e();

const OrderValidator = blueprint.validators.filter(v =>
    v.title.includes("order.order_validator.spend")
);

const OrderValidatorScript = applyParamsToScript(
    OrderValidator[0].compiledCode,
    [
        conStr(1, [builtinByteString(BatchingHash)]),
    ],
    "JSON"
);

const OrderValidatorHash = resolveScriptHash(OrderValidatorScript, "V3");

const OrderValidatorAddr = serializePlutusScript(
    { code: OrderValidatorScript, version: "V3" },
).address;

const OrderValidatorRewardAddress = serializeRewardAddress(
    OrderValidatorHash,
    true,
    0,
);

export {
    OrderValidatorScript,
    OrderValidatorHash,
    OrderValidatorAddr,
    OrderValidatorRewardAddress,
}
