import {
  deserializeAddress,
  mConStr0,
  mScriptAddress,
  stringToHex,
} from "@meshsdk/core";
import {
  blockchainProvider,
  GlobalSettingsNft,
  MinPoolLovelace,
  multiSigAddress,
  multiSigCbor,
  multisigHash,
  multiSigUtxos,
  txBuilder,
  wallet1,
  wallet1Address,
  wallet1Utxos,
  wallet1VK,
  wallet2,
  requireWallet1Collateral,
} from "../setup.js";
import {
  assetType,
  globalSettingsDatum,
  spendScriptSigner,
  stakeType,
  verificationKeySigner,
} from "../data.js";
import {
  GlobalSettingsAddr,
  GlobalSettingsHash,
  GlobalSettingsValidatorScript,
  gsParamTxHash,
  gsParamTxIdx,
} from "./validator.js";
import { CONFIG as ATRIUM_CONFIG } from "../atrium_mainnet/src/config.js";
import { MintingHash } from "../mint/validator.js";
import {
  AtriumPoolNftName,
  AtriumPoolNftNameSource,
  PredictedAtriumPoolNftName,
  RewardsValidatorHash,
} from "../rewards/validator.js";
import { StakeValidatorHash } from "../stake/validator.js";
import { AtriumStakeValidatorHash } from "../stake_datums/atrium/validator.js";
import { AtriumSwapValidatorHash } from "../swap_validators/atrium/validator.js";

const ATRIUM_POOL_STAKE_ASSET_NAME = stringToHex("LADA");

const atriumAsset = assetType("", "", 1_000_000);

const {
  scriptHash: atriumStakePoolPaymentHash,
  stakeCredentialHash: atriumStakePoolStakeKeyHash,
  stakeScriptCredentialHash: atriumStakePoolStakeScriptHash,
} = deserializeAddress(ATRIUM_CONFIG.stakePoolAddress);

if (!atriumStakePoolPaymentHash) {
  throw new Error("Atrium stakePoolAddress must be a script address");
}

const atriumStakePoolAddress = mScriptAddress(
  atriumStakePoolPaymentHash,
  atriumStakePoolStakeScriptHash || atriumStakePoolStakeKeyHash || undefined,
  Boolean(atriumStakePoolStakeScriptHash),
);

const atriumStakeDetail = stakeType(
  atriumAsset,
  ATRIUM_POOL_STAKE_ASSET_NAME,
  atriumStakePoolAddress,
  AtriumStakeValidatorHash,
);

const GlobalSettingsDatum = globalSettingsDatum(
  spendScriptSigner(multisigHash), // admin
  [verificationKeySigner(wallet1VK)], // authorized_batchers
  [atriumAsset], // allowed_assets
  MintingHash, // mint_validator_hash
  [atriumStakeDetail], // stake_details
  mScriptAddress(RewardsValidatorHash), // frost_address
  [AtriumSwapValidatorHash], // authorized_swap_scripts
  StakeValidatorHash, // stake_validator_hash
  RewardsValidatorHash, // rewards_validator_hash
  MinPoolLovelace, // min_pool_lovelace
);

if (!multiSigCbor) {
  throw new Error("multisig cbor doesn't exist");
}

const wallet1Collateral = requireWallet1Collateral();
const adminUtxo = multiSigUtxos[0];
if (!adminUtxo) {
  throw new Error("No multisig UTxO available to authorize global settings creation");
}

const gsParamUtxo = (
  await blockchainProvider.fetchUTxOs(gsParamTxHash, gsParamTxIdx)
)[0];
if (!gsParamUtxo) {
  throw new Error("Global settings parameter UTxO not found");
}

console.log("Predicted Atrium pool NFT:", PredictedAtriumPoolNftName);
console.log("Resolved Atrium pool NFT:", AtriumPoolNftName);
console.log("Atrium pool NFT source:", AtriumPoolNftNameSource);
console.log("Atrium minting policy:", ATRIUM_CONFIG.basketTokenCS);
console.log("Atrium stake validator hash:", AtriumStakeValidatorHash);
console.log("Atrium swap validator hash:", AtriumSwapValidatorHash);
console.log("Stake validator hash:", StakeValidatorHash);
console.log("Rewards validator hash:", RewardsValidatorHash);

const unsignedTx = await txBuilder
  .txIn(
    gsParamUtxo.input.txHash,
    gsParamUtxo.input.outputIndex,
    gsParamUtxo.output.amount,
    gsParamUtxo.output.address,
  )
  .txIn(
    adminUtxo.input.txHash,
    adminUtxo.input.outputIndex,
    adminUtxo.output.amount,
    adminUtxo.output.address,
  )
  .txInScript(multiSigCbor)
  .mintPlutusScriptV3()
  .mint("1", GlobalSettingsHash, GlobalSettingsNft)
  .mintingScript(GlobalSettingsValidatorScript)
  .mintRedeemerValue(mConStr0([]))
  .txOut(GlobalSettingsAddr, [
    { unit: GlobalSettingsHash + GlobalSettingsNft, quantity: "1" },
  ])
  .txOutInlineDatumValue(GlobalSettingsDatum)
  .txOut(multiSigAddress, adminUtxo.output.amount)
  .txInCollateral(
    wallet1Collateral.input.txHash,
    wallet1Collateral.input.outputIndex,
  )
  .setTotalCollateral("5000000")
  .changeAddress(wallet1Address)
  .selectUtxosFrom(wallet1Utxos)
  .complete();

const signedTx1 = await wallet1.signTx(unsignedTx, true);
const signedTx2 = await wallet2.signTx(signedTx1, true);

const txHash = await wallet1.submitTx(signedTx2);
console.log("Create global settings tx hash:", txHash);
