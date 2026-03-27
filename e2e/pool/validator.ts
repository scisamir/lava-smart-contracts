import {
  applyParamsToScript,
  builtinByteString,
  resolveScriptHash,
  serializePlutusScript,
} from "@meshsdk/core";
import { blueprint, NETWORK_ID } from "../setup.js";
import { GlobalSettingsHash } from "../global_settings/validator.js";
import { serializeSelfStakedValidatorAddress } from "../data.js";

const PoolValidator = blueprint.validators.filter((v) =>
  v.title.includes("pool.pool_validator.mint"),
);

const PoolValidatorScript = applyParamsToScript(
  PoolValidator[0].compiledCode,
  [builtinByteString(GlobalSettingsHash)],
  "JSON",
);

const PoolValidatorHash = resolveScriptHash(PoolValidatorScript, "V3");

const PoolValidatorAddr = serializePlutusScript(
  { code: PoolValidatorScript, version: "V3" },
  undefined,
  NETWORK_ID,
  undefined,
).address;

const PoolValidatorAddrWithStake = serializeSelfStakedValidatorAddress(
  PoolValidatorScript,
  PoolValidatorHash,
  NETWORK_ID,
);

export {
  PoolValidatorScript,
  PoolValidatorHash,
  PoolValidatorAddrWithStake as PoolValidatorAddr,
};
