import {
  applyParamsToScript,
  builtinByteString,
  scriptAddress,
  deserializeAddress,
  mConStr1,
  mScriptAddress,
  resolveScriptHash,
  stringToHex,
} from "@meshsdk/core";
import {
  blueprint,
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
  computePoolNftName,
  globalSettingsDatum,
  spendScriptSigner,
  stakeType,
  verificationKeySigner,
} from "../data.js";
import {
  GlobalSettingsAddr,
  GlobalSettingsHash,
  GlobalSettingsValidatorScript,
} from "./validator.js";
import { CONFIG as ATRIUM_CONFIG } from "../atrium_mainnet/src/config.js";
import { MintingHash } from "../mint/validator.js";
import { PoolValidatorHash } from "../pool/validator.js";

const ATRIUM_POOL_STAKE_ASSET_NAME = stringToHex("LADA");

const requireValidator = (title: string) => {
  const validator = blueprint.validators.find((item) => item.title === title);

  if (!validator) {
    throw new Error(`Validator not found in blueprint: ${title}`);
  }

  return validator;
};

const atriumAsset = assetType("", "", 1_000_000);

const predictedAtriumPoolSeedUtxo = multiSigUtxos[0];
if (!predictedAtriumPoolSeedUtxo) {
  throw new Error("No multisig UTxO available to derive the Atrium pool NFT");
}

// The rewards validator is parameterized by the pool NFT name, so before the
// pool exists we derive the expected Atrium pool NFT from the seed UTxO this
// flow is currently anchored to.
const predictedAtriumPoolNftName = computePoolNftName(
  predictedAtriumPoolSeedUtxo.input.txHash,
  predictedAtriumPoolSeedUtxo.input.outputIndex,
);

const StakeValidatorScript = applyParamsToScript(
  requireValidator("stake.stake_validator.withdraw").compiledCode,
  [builtinByteString(GlobalSettingsHash), builtinByteString(PoolValidatorHash)],
  "JSON",
);
const StakeValidatorHash = resolveScriptHash(StakeValidatorScript, "V3");

const RewardsValidatorScript = applyParamsToScript(
  requireValidator("rewards.rewards_validator.spend").compiledCode,
  [
    builtinByteString(GlobalSettingsHash),
    builtinByteString(PoolValidatorHash),
    builtinByteString(predictedAtriumPoolNftName),
  ],
  "JSON",
);
const RewardsValidatorHash = resolveScriptHash(RewardsValidatorScript, "V3");

const AtriumStakeValidatorScript = applyParamsToScript(
  requireValidator("stake_datums/atrium.atrium.withdraw").compiledCode,
  [
    builtinByteString(GlobalSettingsHash),
    builtinByteString(MintingHash),
    scriptAddress(RewardsValidatorHash),
  ],
  "JSON",
);
const AtriumStakeValidatorHash = resolveScriptHash(AtriumStakeValidatorScript, "V3");

const AtriumSwapValidatorScript = applyParamsToScript(
  requireValidator("swap_validators/atrium_swap.atrium_swap.withdraw").compiledCode,
  [builtinByteString(MintingHash), scriptAddress(RewardsValidatorHash)],
  "JSON",
);
const AtriumSwapValidatorHash = resolveScriptHash(AtriumSwapValidatorScript, "V3");

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
  throw new Error("No multisig UTxO available to authorize the update");
}

const gsUtxo = (await blockchainProvider.fetchAddressUTxOs(GlobalSettingsAddr))[0];
if (!gsUtxo) {
  throw new Error("Global settings UTxO not found");
}

console.log("Predicted Atrium pool NFT:", predictedAtriumPoolNftName);
console.log("Atrium stake validator hash:", AtriumStakeValidatorHash);
console.log("Atrium swap validator hash:", AtriumSwapValidatorHash);
console.log("Stake validator hash:", StakeValidatorHash);
console.log("Rewards validator hash:", RewardsValidatorHash);

const unsignedTx = await txBuilder
  .txIn(
    adminUtxo.input.txHash,
    adminUtxo.input.outputIndex,
    adminUtxo.output.amount,
    adminUtxo.output.address,
  )
  .txInScript(multiSigCbor)
  .spendingPlutusScriptV3()
  .txIn(
    gsUtxo.input.txHash,
    gsUtxo.input.outputIndex,
    gsUtxo.output.amount,
    gsUtxo.output.address,
  )
  .txInScript(GlobalSettingsValidatorScript)
  .txInInlineDatumPresent()
  .txInRedeemerValue(mConStr1([]))
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
console.log("Update global settings tx hash:", txHash);
