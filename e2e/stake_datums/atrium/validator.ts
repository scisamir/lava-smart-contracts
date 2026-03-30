import {
  applyParamsToScript,
  builtinByteString,
  resolveScriptHash,
  scriptAddress,
  serializeRewardAddress,
} from "@meshsdk/core";
import { CONFIG as ATRIUM_CONFIG } from "../../atrium_mainnet/src/config.js";
import { GlobalSettingsHash } from "../../global_settings/validator.js";
import { RewardsValidatorHash } from "../../rewards/validator.js";
import { blueprint, NETWORK_ID } from "../../setup.js";

const AtriumStakeValidator = blueprint.validators.filter((v) =>
  v.title.includes("stake_datums/atrium.atrium.withdraw"),
);

const AtriumStakeValidatorScript = applyParamsToScript(
  AtriumStakeValidator[0].compiledCode,
  [
    builtinByteString(GlobalSettingsHash),
    builtinByteString(ATRIUM_CONFIG.basketTokenCS),
    scriptAddress(RewardsValidatorHash),
  ],
  "JSON",
);

const AtriumStakeValidatorHash = resolveScriptHash(
  AtriumStakeValidatorScript,
  "V3",
);

const AtriumStakeRewardAddress = serializeRewardAddress(
  AtriumStakeValidatorHash,
  true,
  NETWORK_ID,
);

export {
  AtriumStakeValidatorScript,
  AtriumStakeValidatorHash,
  AtriumStakeRewardAddress,
};
