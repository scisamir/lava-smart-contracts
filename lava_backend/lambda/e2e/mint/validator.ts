import {
  applyParamsToScript,
  builtinByteString,
  conStr,
  resolveScriptHash,
  serializePlutusScript,
} from "@meshsdk/core";
import { setupE2e } from "../setup";
import { GlobalSettingsHash } from "../global_settings/validator";
import { BatchingHash } from "../batching/validator";

const { blueprint, NETWORK_ID } = setupE2e();
const networkId = NETWORK_ID as 0 | 1;

const MintingValidator = blueprint.validators.filter((v: any) =>
  v.title.includes("minting.minting.mint")
);

const MintingValidatorScript = applyParamsToScript(
  MintingValidator[0].compiledCode,
  [conStr(1, [builtinByteString(BatchingHash)]), builtinByteString(GlobalSettingsHash)],
  "JSON"
);

const MintingHash = resolveScriptHash(MintingValidatorScript, "V3");

const MintingAddr = serializePlutusScript(
  { code: MintingValidatorScript, version: "V3" },
  undefined,
  networkId,
  undefined,
).address;

export { MintingValidatorScript, MintingHash, MintingAddr };
