import {
  applyParamsToScript,
  builtinByteString,
  resolveScriptHash,
  serializePlutusScript,
} from "@meshsdk/core";
import { GlobalSettingsHash } from "../global_settings/validator";
import { setupE2e } from "../setup";
import { serializeSelfStakedValidatorAddress } from "../data";

const { blueprint, NETWORK_ID } = setupE2e();
const networkId = NETWORK_ID as 0 | 1;

const PoolValidator = blueprint.validators.filter((v: any) =>
  v.title.includes("pool.pool_validator.mint")
);

const PoolValidatorScript = applyParamsToScript(
  PoolValidator[0].compiledCode,
  [builtinByteString(GlobalSettingsHash)],
  "JSON"
);

const PoolValidatorHash = resolveScriptHash(PoolValidatorScript, "V3");

const PoolValidatorAddr = serializePlutusScript(
  { code: PoolValidatorScript, version: "V3" },
  undefined,
  networkId,
  undefined,
).address;

const PoolValidatorAddrWithStake = serializeSelfStakedValidatorAddress(
  PoolValidatorScript,
  PoolValidatorHash,
  networkId,
);

export {
  PoolValidatorScript,
  PoolValidatorHash,
  PoolValidatorAddrWithStake as PoolValidatorAddr,
};
