import { deserializeAddress, mConStr0, mScriptAddress } from "@meshsdk/core";
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
  verificationKeySigner,
} from "../data.js";
import {
  GlobalSettingsAddr,
  GlobalSettingsHash,
  GlobalSettingsValidatorScript,
  gsParamTxHash,
  gsParamTxIdx,
} from "./validator.js";
import { MintingHash } from "../mint/validator.js";
import { StakeValidatorHash } from "../stake/validator.js";

const adaAsset = assetType("", "", 1_000_000);
const {
  scriptHash: frostPaymentHash,
  stakeCredentialHash: frostStakeKeyHash,
  stakeScriptCredentialHash: frostStakeScriptHash,
} = deserializeAddress(multiSigAddress);

if (!frostPaymentHash) {
  throw new Error("multiSigAddress must be a script address");
}

const frostAddress = mScriptAddress(
  frostPaymentHash,
  frostStakeScriptHash || frostStakeKeyHash || undefined,
  Boolean(frostStakeScriptHash),
);

const GlobalSettingsDatum = globalSettingsDatum(
  spendScriptSigner(multisigHash), // admin
  [verificationKeySigner(wallet1VK)], // authorized_batchers
  [adaAsset], // allowed_assets
  MintingHash, // mint_validator_hash
  [], // stake_details
  frostAddress, // frost_address
  [], // authorized_swap_scripts
  StakeValidatorHash, // stake_validator_hash
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

console.log("Stake validator hash:", StakeValidatorHash);
console.log("Creating bootstrap global settings");

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
