import {
  applyParamsToScript,
  builtinByteString,
  conStr0,
  conStr1,
  conStr2,
  conStr3,
  resolveScriptHash,
  serializeRewardAddress,
} from "@meshsdk/core";
import blueprint from "../../smart_contract/plutus.json" with { type: "json" };
import {
  NETWORK_CONFIG,
  NETWORK_ID,
  type SignerConfig,
} from "../network.js";
import { PoolValidatorHash } from "../pool/validator.js";

const signerData = (signer: SignerConfig) => {
  switch (signer.type) {
    case "verificationKey":
      return conStr0([builtinByteString(signer.hash)]);
    case "spendScript":
      return conStr1([builtinByteString(signer.hash)]);
    case "withdrawScript":
      return conStr2([builtinByteString(signer.hash)]);
    case "mintScript":
      return conStr3([builtinByteString(signer.hash)]);
  }
};

const validators = blueprint.validators.filter((validator) =>
  validator.title.includes(
    "admin_controller.admin_controller.withdraw",
  ),
);

if (validators.length !== 1) {
  throw new Error(
    `Expected one admin controller validator, found ${validators.length}`,
  );
}

if (NETWORK_CONFIG.adminController.poolToggler.type === "mintScript") {
  throw new Error("The pool toggler cannot use mint script authorization");
}

const AdminControllerScript = applyParamsToScript(
  validators[0].compiledCode,
  [
    builtinByteString(PoolValidatorHash),
    signerData(NETWORK_CONFIG.adminController.fullAdmin),
    signerData(NETWORK_CONFIG.adminController.poolToggler),
  ],
  "JSON",
);

const AdminControllerHash = resolveScriptHash(AdminControllerScript, "V3");

const AdminControllerRewardAddress = serializeRewardAddress(
  AdminControllerHash,
  true,
  NETWORK_ID,
);

export {
  AdminControllerHash,
  AdminControllerRewardAddress,
  AdminControllerScript,
};
