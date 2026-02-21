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
  network: "Preprod",
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
    words: wallet1Passphrase.split(" "),
  },
});

const wallet1Address = await wallet1.getChangeAddress();

const wallet1Utxos = await wallet1.getUtxos();

const wallet1Collateral: UTxO = wallet1Utxos.filter(
  (utxo) =>
    Number(utxo.output.amount[0].quantity) >= 12000000 &&
    utxo.output.amount.length <= 4,
)[0];
if (!wallet1Collateral) {
  throw new Error("No collateral utxo found");
}

const { pubKeyHash: wallet1VK, stakeCredentialHash: wallet1SK } =
  deserializeAddress(wallet1Address);

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
    words: wallet2Passphrase.split(" "),
  },
});
const wallet2Address = await wallet2.getChangeAddress();
const { pubKeyHash: wallet2VK, stakeCredentialHash: wallet2SK } =
  deserializeAddress(wallet2Address);

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
const { address: multiSigAddress, scriptCbor: multiSigCbor } =
  serializeNativeScript(nativeScript);
const multisigHash = resolveNativeScriptHash(nativeScript);
const multiSigUtxos =
  await blockchainProvider.fetchAddressUTxOs(multiSigAddress);

console.log("wallet1VK:", wallet1VK);
console.log("wallet2VK:", wallet2VK);
console.log("multiSigAddress:", multiSigAddress);
console.log(
  "w1 asdcfg:",
  (await wallet1.getAssets()).find(
    (ast) =>
      ast.unit ===
      "def68337867cb4f1f95b6b811fedbfcdd7780d10a95cc072077088ea74657374",
  )?.quantity,
);

// Create transaction builder
const txBuilder = new MeshTxBuilder({
  fetcher: blockchainProvider,
  submitter: blockchainProvider,
  evaluator: blockchainProvider,
  // evaluator: blockfrostProvider,
  verbose: false,
});
txBuilder.setNetwork("preprod");
// txBuilder.txEvaluationMultiplier = 1.6

// test mint
// Always success mint validator
const alwaysSuccessMintValidator =
  "585401010029800aba2aba1aab9eaab9dab9a4888896600264653001300600198031803800cc0180092225980099b8748000c01cdd500144c9289bae30093008375400516401830060013003375400d149a26cac8009";
const alwaysSuccessValidatorMintScript = applyParamsToScript(
  alwaysSuccessMintValidator,
  [],
  "JSON",
);
const alwaysSuccessMintValidatorHash = resolveScriptHash(
  alwaysSuccessValidatorMintScript,
  "V3",
);
console.log("alwaysSuccessMintValidatorHash:", alwaysSuccessMintValidatorHash);

// Constants
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

// Reference scripts
const batchingScriptTxHash =
  "8fdab4023d695d356810bb8ddbadb0afb2043692d68f306ad51e6e0141622a29";
const batchingScriptTxIdx = 0;
const poolScriptTxHash =
  "20bd8c588dca842f8a4248f67344d5bba175ea5f7ce82e2531837ec2000dbc4b";
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
  tStrikeAssetName,
  tStrikeUnit,
  tStrikePoolStakeAssetName,
  tPulseAssetName,
  tPulseUnit,
  tPulsePoolStakeAssetName,
  // Ref scripts
  batchingScriptTxHash,
  batchingScriptTxIdx,
  poolScriptTxHash,
  poolScriptTxIdx,
};
