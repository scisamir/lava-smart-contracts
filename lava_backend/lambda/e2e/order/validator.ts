import {
  applyParamsToScript,
  builtinByteString,
  conStr,
  resolveScriptHash,
  serializePlutusScript,
  serializeRewardAddress,
} from "@meshsdk/core";
import { setupE2e } from "../setup";
import { BatchingHash } from "../batching/validator";
import { GlobalSettingsHash } from "../global_settings/validator";
import { serializeSelfStakedValidatorAddress } from "../data";

const { blueprint, NETWORK_ID } = setupE2e();
const networkId = NETWORK_ID as 0 | 1;

const OrderValidator = blueprint.validators.filter((v: any) =>
  v.title.includes("order.order_validator.spend")
);

const OrderValidatorScript = applyParamsToScript(
  OrderValidator[0].compiledCode,
  [
    builtinByteString(GlobalSettingsHash),
    conStr(1, [builtinByteString(BatchingHash)]),
  ],
  "JSON"
);

const OrderValidatorHash = resolveScriptHash(OrderValidatorScript, "V3");

const OrderValidatorAddr = serializePlutusScript(
  {
    code: OrderValidatorScript,
    version: "V3",
  },
  undefined,
  NETWORK_ID,
  undefined,
).address;

const OrderValidatorAddrWithStake = serializeSelfStakedValidatorAddress(
  OrderValidatorScript,
  OrderValidatorHash,
  networkId
);

const OrderValidatorRewardAddress = serializeRewardAddress(
  OrderValidatorHash,
  true,
  networkId
);

export {
  OrderValidatorScript,
  OrderValidatorHash,
  OrderValidatorAddrWithStake as OrderValidatorAddr,
  OrderValidatorRewardAddress,
};
