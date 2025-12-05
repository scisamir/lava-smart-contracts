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
import blueprint from "../smart_contract/plutus.json" with { type: "json" };

// Setup blockhain provider as Maestro
const maestroKey = process.env.MAESTRO_KEY;
if (!maestroKey) {
    throw new Error("MAESTRO_KEY does not exist");
}
const blockchainProvider = new MaestroProvider({
    network: 'Preprod',
    apiKey: maestroKey,
});

// Setup blockhain provider as Blockfrost
// const blockfrostId = process.env.BLOCKFROST_ID;
// if (!blockfrostId) {
//     throw new Error("BLOCKFROST_ID does not exist");
// }
// const blockfrostProvider = new BlockfrostProvider(blockfrostId);

// import admin's wallet passphrase and initialize the wallet
const wallet1Passphrase = process.env.WALLET_PASSPHRASE_ONE;
if (!wallet1Passphrase) {
    throw new Error("WALLET_PASSPHRASE_ONE does not exist");
}
const wallet1 = new MeshWallet({
    networkId: 0,
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    key: {
        type: "mnemonic",
        words: wallet1Passphrase.split(' ')
    },
});

const wallet1Address = await wallet1.getChangeAddress();

const wallet1Utxos = await wallet1.getUtxos();

const wallet1Collateral: UTxO = (await blockchainProvider.fetchUTxOs("59c1948af8f7fc5b51291b5aa644e4ee75bb79c7b88d6d365c46d3b2abfe630f", 1))[0]
// const wallet1Collateral: UTxO = (await wallet1.getCollateral())[0]
if (!wallet1Collateral) {
    throw new Error('No collateral utxo found');
}

const { pubKeyHash: wallet1VK, stakeCredentialHash: wallet1SK } = deserializeAddress(wallet1Address);

// Setup wallet2
const wallet2Passphrase = process.env.WALLET_PASSPHRASE_TWO;
if (!wallet2Passphrase) {
    throw new Error("WALLET_PASSPHRASE_TWO does not exist");
}
const wallet2 = new MeshWallet({
    networkId: 0,
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    key: {
        type: "mnemonic",
        words: wallet2Passphrase.split(' ')
    },
});
// Needs to be changed below to wallet 2 address;
const wallet2Address = await wallet2.getChangeAddress();
const { pubKeyHash: wallet2VK, stakeCredentialHash: wallet2SK } = deserializeAddress(wallet2Address);

console.log("wallet1VK:", wallet1VK);
console.log("wallet2VK:", wallet2VK);

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
// console.log("multisigHash:", multisigHash);
const multiSigUtxos = await blockchainProvider.fetchAddressUTxOs(multiSigAddress);
// console.log("multiSigUtxos:", multiSigUtxos);
// console.log("multiSigUtxos:", multiSigUtxos[0].output.amount);

// Create transaction builder
const txBuilder = new MeshTxBuilder({
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    evaluator: blockchainProvider,
    // evaluator: blockfrostProvider,
    verbose: false,
});
txBuilder.setNetwork('preprod');
// txBuilder.txEvaluationMultiplier = 1.6

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

export {
    blueprint,
    blockchainProvider,
    txBuilder,
    wallet1,
    wallet1Address,
    wallet1VK,
    wallet1SK,
    wallet1Utxos,
    wallet1Collateral,
    wallet2,
    wallet2Address,
    wallet2VK,
    wallet2SK,
    multisigHash,
    multiSigAddress,
    multiSigCbor,
    multiSigUtxos,
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
