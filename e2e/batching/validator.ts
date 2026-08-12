import {
  applyParamsToScript,
  builtinByteString,
  resolveScriptHash,
  serializePlutusScript,
  serializeRewardAddress,
} from "@meshsdk/core";
import { blueprint, NETWORK_ID } from "../setup.js";
import { GlobalSettingsHash } from "../global_settings/validator.js";
import { PoolValidatorHash } from "../pool/validator.js";

const BatchingValidator = blueprint.validators.filter((v) =>
  v.title.includes("pool_batching.pool_batching.withdraw"),
);

const BatchingValidatorScript = applyParamsToScript(
  BatchingValidator[0].compiledCode,
  [builtinByteString(GlobalSettingsHash), builtinByteString(PoolValidatorHash)],
  "JSON",
);

const BatchingHash = resolveScriptHash(BatchingValidatorScript, "V3");

const BatchingAddr = serializePlutusScript(
  {
    code: BatchingValidatorScript,
    version: "V3",
  },
  undefined,
  NETWORK_ID,
  undefined,
).address;

const BatchingRewardAddress = serializeRewardAddress(
  BatchingHash,
  true,
  NETWORK_ID,
);

export {
  BatchingValidatorScript,
  BatchingHash,
  BatchingAddr,
  BatchingRewardAddress,
};
