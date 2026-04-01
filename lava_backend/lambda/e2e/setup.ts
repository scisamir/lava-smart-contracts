import {
  NativeScript,
  applyParamsToScript,
  resolveNativeScriptHash,
  resolveScriptHash,
  serializeNativeScript,
  stringToHex,
} from "@meshsdk/core";
import blueprint from "../../../smart_contract/plutus.json";

export const setupE2e = () => {
  const NETWORK_ID = 1;

  const wallet1VK = "1cf3f4f03d7246a72f07b23d3300378f8f2e159716b11ed6f95f73f3";
  const wallet2VK = "f7dd4a3c0dd50061eaa9b83b9ee1a9ddcd2cf4dc17357940db5a231e";

  const nativeScript: NativeScript = {
    type: "all",
    scripts: [
      { type: "sig", keyHash: wallet1VK },
      { type: "sig", keyHash: wallet2VK },
    ],
  };

  const { address: multiSigAddress, scriptCbor: multiSigCbor } =
    serializeNativeScript(nativeScript, undefined, NETWORK_ID);
  const multisigHash = resolveNativeScriptHash(nativeScript);

  const alwaysSuccessMintValidator =
    "585401010029800aba2aba1aab9eaab9dab9a4888896600264653001300600198031803800cc0180092225980099b8748000c01cdd500144c9289bae30093008375400516401830060013003375400d149a26cac8009";

  const alwaysSuccessValidatorMintScript = applyParamsToScript(
    alwaysSuccessMintValidator,
    [],
    "JSON"
  );

  const alwaysSuccessMintValidatorHash = resolveScriptHash(
    alwaysSuccessValidatorMintScript,
    "V3"
  );

  const GlobalSettingsNft = stringToHex("GSN");
  const LavaPoolNftName = stringToHex("LPN");
  const MinPoolLovelace = 5_000_000;
  const PrecisionFactor = 100_000;

  const testAssetName = stringToHex("test");
  const testUnit = alwaysSuccessMintValidatorHash + testAssetName;
  const poolStakeAssetName = stringToHex("stTest");

  const tStrikeAssetName = stringToHex("tStrike");
  const tStrikeUnit = alwaysSuccessMintValidatorHash + tStrikeAssetName;
  const tStrikePoolStakeAssetName = stringToHex("LStrike");

  const tPulseAssetName = stringToHex("tPulse");
  const tPulseUnit = alwaysSuccessMintValidatorHash + tPulseAssetName;
  const tPulsePoolStakeAssetName = stringToHex("LPulse");

  const ATRIUM_POOL_STAKE_ASSET_NAME = stringToHex("LADA");

  const batchingScriptTxHash =
    "f268168603dc31abf523acabb72b8c47662a9e33efd5a44f7f1f6f4358ef247d";
  const batchingScriptTxIdx = 0;
  const poolScriptTxHash =
    "6dd8752d81233d08afe8193116c051eed24b83d5b3747f1eac3511dba4e1b3d8";
  const poolScriptTxIdx = 0;

  return {
    blueprint,
    NETWORK_ID,
    wallet1VK,
    wallet2VK,
    multisigHash,
    multiSigAddress,
    multiSigCbor,
    alwaysSuccessValidatorMintScript,
    alwaysSuccessMintValidatorHash,
    GlobalSettingsNft,
    LavaPoolNftName,
    MinPoolLovelace,
    PrecisionFactor,
    testAssetName,
    testUnit,
    poolStakeAssetName,
    tStrikeAssetName,
    tStrikeUnit,
    tStrikePoolStakeAssetName,
    tPulseAssetName,
    tPulseUnit,
    tPulsePoolStakeAssetName,
    ATRIUM_POOL_STAKE_ASSET_NAME,
    batchingScriptTxHash,
    batchingScriptTxIdx,
    poolScriptTxHash,
    poolScriptTxIdx,
  };
};