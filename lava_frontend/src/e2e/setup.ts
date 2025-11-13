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
import dotenv from "dotenv";
dotenv.config();
import blueprint from "../../../smart_contract/plutus_copy.json" with { type: "json" };

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
    const batchingScriptTxHash = "6d08fef4a6e91e345348443c0ddf1a0ea337c7e42d98d0dddf1096b2f6757f9b";
    const batchingScriptTxIdx = 0;

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
    }
}
