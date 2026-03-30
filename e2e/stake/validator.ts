import {
  applyParamsToScript,
  builtinByteString,
  resolveScriptHash,
  serializeRewardAddress,
} from "@meshsdk/core";
import { GlobalSettingsHash } from "../global_settings/validator.js";
import { PoolValidatorHash } from "../pool/validator.js";
import { blueprint, NETWORK_ID } from "../setup.js";

const StakeValidator = blueprint.validators.filter((v) =>
  v.title.includes("stake.stake_validator.withdraw"),
);

const StakeValidatorScript = applyParamsToScript(
  StakeValidator[0].compiledCode,
  [builtinByteString(GlobalSettingsHash), builtinByteString(PoolValidatorHash)],
  "JSON",
);

const StakeValidatorHash = resolveScriptHash(StakeValidatorScript, "V3");

const StakeRewardAddress = serializeRewardAddress(
  StakeValidatorHash,
  true,
  NETWORK_ID,
);

export { StakeValidatorScript, StakeValidatorHash, StakeRewardAddress };
