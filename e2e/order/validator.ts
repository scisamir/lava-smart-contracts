import {
  applyParamsToScript,
  builtinByteString,
  conStr,
  resolveScriptHash,
  serializePlutusScript,
  serializeRewardAddress,
} from "@meshsdk/core";
import { blueprint } from "../setup.js";
import { BatchingHash } from "../batching/validator.js";
import { GlobalSettingsHash } from "../global_settings/validator.js";
import { serializeSelfStakedValidatorAddress } from "../data.js";

const OrderValidator = blueprint.validators.filter((v) =>
  v.title.includes("order.order_validator.spend"),
);

const OrderValidatorScript = applyParamsToScript(
  OrderValidator[0].compiledCode,
  [
    builtinByteString(GlobalSettingsHash),
    conStr(1, [builtinByteString(BatchingHash)]),
  ],
  "JSON",
);

const OrderValidatorHash = resolveScriptHash(OrderValidatorScript, "V3");

const OrderValidatorAddr = serializePlutusScript({
  code: OrderValidatorScript,
  version: "V3",
}).address;

const OrderValidatorAddrWithStake = serializeSelfStakedValidatorAddress(
  OrderValidatorScript,
  OrderValidatorHash,
);

export {
  OrderValidatorScript,
  OrderValidatorHash,
  OrderValidatorAddrWithStake as OrderValidatorAddr,
};
