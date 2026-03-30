import {
  applyParamsToScript,
  builtinByteString,
  resolveScriptHash,
  scriptAddress,
  serializeRewardAddress,
} from "@meshsdk/core";
import { CONFIG as ATRIUM_CONFIG } from "../../atrium_mainnet/src/config.js";
import { RewardsValidatorHash } from "../../rewards/validator.js";
import { blueprint, NETWORK_ID } from "../../setup.js";

const AtriumSwapValidator = blueprint.validators.filter((v) =>
  v.title.includes("swap_validators/atrium_swap.atrium_swap.withdraw"),
);

const AtriumSwapValidatorScript = applyParamsToScript(
  AtriumSwapValidator[0].compiledCode,
  [
    builtinByteString(ATRIUM_CONFIG.basketTokenCS),
    scriptAddress(RewardsValidatorHash),
  ],
  "JSON",
);

const AtriumSwapValidatorHash = resolveScriptHash(
  AtriumSwapValidatorScript,
  "V3",
);

const AtriumSwapRewardAddress = serializeRewardAddress(
  AtriumSwapValidatorHash,
  true,
  NETWORK_ID,
);

export {
  AtriumSwapValidatorScript,
  AtriumSwapValidatorHash,
  AtriumSwapRewardAddress,
};
