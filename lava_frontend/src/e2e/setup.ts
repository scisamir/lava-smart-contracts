import {
    BlockfrostProvider,
    MaestroProvider,
    MeshTxBuilder,
    MeshWallet,
    NativeScript,
    UTxO,
    applyParamsToScript,
    deserializeAddress,
    resolveNativeScriptHash,
    resolveScriptHash,
    serializeNativeScript,
    stringToHex,
} from "@meshsdk/core";
import blueprint from "../../../smart_contract/plutus.json" with { type: "json" };

export const setupE2e = () => {
    const wallet1VK = "96cbb27c96daf8cab890de6d7f87f5ffd025bf8ac80717cbc4fae7da";
    const wallet2VK = "331da30f7c8fea429e2bdc161efde817cbb06f78a53ef5ceee42c9a3";

    // Setup multisig
    const nativeScript: NativeScript = {
        type: "all",
        scripts: [
            {
                type: "sig",
                keyHash: wallet1VK,
            },
            {
                type: "sig",
                keyHash: wallet2VK,
            },
        ],
    };
    const { address: multiSigAddress, scriptCbor: multiSigCbor } = serializeNativeScript(nativeScript);
    // console.log("nativeScript:", nativeScript);
    // console.log("serializeNativeScript:", serializeNativeScript(nativeScript));
    const multisigHash = resolveNativeScriptHash(nativeScript);

    // test mint
    // Always success mint validator
    const alwaysSuccessMintValidator = "585401010029800aba2aba1aab9eaab9dab9a4888896600264653001300600198031803800cc0180092225980099b8748000c01cdd500144c9289bae30093008375400516401830060013003375400d149a26cac8009";
    const alwaysSuccessValidatorMintScript = applyParamsToScript(
        alwaysSuccessMintValidator,
        [],
        "JSON",
    );
    const alwaysSuccessMintValidatorHash = resolveScriptHash(alwaysSuccessValidatorMintScript, "V3");
    console.log("alwaysSuccessMintValidatorHash:", alwaysSuccessMintValidatorHash);

    // Constants
    const GlobalSettingsNft = stringToHex("GSN");
    const LavaPoolNftName = stringToHex("LPN");
    const MinPoolLovelace = 5_000_000
    const PrecisionFactor = 100_000;

    const testAssetName = stringToHex("test");
    const testUnit = alwaysSuccessMintValidatorHash + testAssetName;
    const poolStakeAssetName = stringToHex("stTest");

    // Reference scripts
    const batchingScriptTxHash = "63fb5c611cedb66a55f367c94f3e1f0263b40f6391a9a74b903f38253884c7b8";
    const batchingScriptTxIdx = 0;
    const poolScriptTxHash = "b8fc5e1c3ddd1a10adc307536639c83d9c2928c05732015c045af272d0f8e45c";
    const poolScriptTxIdx = 0;

    return {
        blueprint,
        wallet1VK,
        wallet2VK,
        multisigHash,
        multiSigAddress,
        multiSigCbor,
        alwaysSuccessValidatorMintScript,
        alwaysSuccessMintValidatorHash,
        // Constants
        GlobalSettingsNft,
        LavaPoolNftName,
        MinPoolLovelace,
        PrecisionFactor,
        testAssetName,
        testUnit,
        poolStakeAssetName,
        // Ref scripts
        batchingScriptTxHash,
        batchingScriptTxIdx,
        poolScriptTxHash,
        poolScriptTxIdx,
    }
}
