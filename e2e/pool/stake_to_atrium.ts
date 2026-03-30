import {
  applyParamsToScript,
  builtinByteString,
  deserializeDatum,
  mConStr0,
  mConStr2,
  resolveScriptHash,
  scriptAddress,
  serializeAddressObj,
  serializePlutusScript,
  serializeRewardAddress,
  type Asset,
} from "@meshsdk/core";
import { applyParamsToScript as applyCslParamsToScript } from "@meshsdk/core-csl";
import {
  CONFIG as ATRIUM_CONFIG,
  STAKE_POOL_UNIT,
} from "../atrium_mainnet/src/config.js";
import { encodeStakePoolDatum } from "../atrium_mainnet/src/datum.js";
import {
  formatExRate,
  formatLovelace,
  lovelaceToBasketTokens,
} from "../atrium_mainnet/src/math.js";
import {
  fetchBasketUtxos,
  getLovelace,
  pickStakePoolUtxo,
} from "../atrium_mainnet/src/queries.js";
import { assetType } from "../data.js";
import {
  GlobalSettingsAddr,
  GlobalSettingsHash,
} from "../global_settings/validator.js";
import { RewardsValidatorHash as PredictedRewardsValidatorHash } from "../rewards/validator.js";
import {
  ATRIUM_POOL_STAKE_ASSET_NAME,
  blueprint,
  blockchainProvider,
  MinPoolLovelace,
  NETWORK_ID,
  poolScriptTxHash,
  poolScriptTxIdx,
  txBuilder,
  wallet1,
  wallet1Address,
  wallet1Utxos,
  wallet1VK,
  requireWallet1Collateral,
} from "../setup.js";
import { PoolDatumType } from "../types.js";
import { PoolValidatorAddr, PoolValidatorHash } from "./validator.js";
import {
  StakeRewardAddress,
  StakeValidatorHash,
  StakeValidatorScript,
} from "../stake/validator.js";

const REWARD_OUTPUT_LOVELACE = 2_500_000n;
const POOL_STAKE_REDEEMER = mConStr2([]);
const ATRIUM_DEPOSIT_REDEEMER = { constructor: 0, fields: [] };
type SerializedAddressObject = Parameters<typeof serializeAddressObj>[0];

const requireValidator = (title: string) => {
  const validator = blueprint.validators.find((item) => item.title === title);

  if (!validator) {
    throw new Error(`Validator not found in blueprint: ${title}`);
  }

  return validator;
};

const getQuantity = (assets: Asset[], unit: string): bigint =>
  BigInt(assets.find((asset) => asset.unit === unit)?.quantity ?? "0");

const getBytes = (value: unknown, label: string): string => {
  if (
    typeof value === "object" &&
    value !== null &&
    "bytes" in value &&
    typeof (value as { bytes: unknown }).bytes === "string"
  ) {
    return (value as { bytes: string }).bytes;
  }

  throw new Error(`Expected bytes for ${label}`);
};

const getOptionValue = (value: unknown, label: string): unknown | null => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("constructor" in value) ||
    !("fields" in value)
  ) {
    throw new Error(`Expected option value for ${label}`);
  }

  const option = value as {
    constructor: number | string | bigint;
    fields: unknown[];
  };
  const constructor = Number(option.constructor);

  if (constructor === 1) {
    return null;
  }

  if (constructor === 0) {
    return option.fields[0];
  }

  throw new Error(
    `Invalid option constructor for ${label}: ${String(option.constructor)}`,
  );
};

const getOptionBytes = (value: unknown, label: string): string | null => {
  const optionValue = getOptionValue(value, label);
  return optionValue === null ? null : getBytes(optionValue, label);
};

const deriveAtriumScripts = (poolNftName: string) => {
  const rewardsValidatorScript = applyParamsToScript(
    requireValidator("rewards.rewards_validator.spend").compiledCode,
    [
      builtinByteString(GlobalSettingsHash),
      builtinByteString(PoolValidatorHash),
      builtinByteString(poolNftName),
    ],
    "JSON",
  );
  const rewardsValidatorHash = resolveScriptHash(rewardsValidatorScript, "V3");
  const rewardsValidatorAddr = serializePlutusScript(
    { code: rewardsValidatorScript, version: "V3" },
    undefined,
    NETWORK_ID,
    undefined,
  ).address;

  const atriumStakeValidatorScript = applyParamsToScript(
    requireValidator("stake_datums/atrium.atrium.withdraw").compiledCode,
    [
      builtinByteString(GlobalSettingsHash),
      builtinByteString(ATRIUM_CONFIG.basketTokenCS),
      scriptAddress(rewardsValidatorHash),
    ],
    "JSON",
  );
  const atriumStakeValidatorHash = resolveScriptHash(
    atriumStakeValidatorScript,
    "V3",
  );
  const atriumStakeRewardAddress = serializeRewardAddress(
    atriumStakeValidatorHash,
    true,
    NETWORK_ID,
  );

  return {
    rewardsValidatorHash,
    rewardsValidatorAddr,
    atriumStakeValidatorScript,
    atriumStakeValidatorHash,
    atriumStakeRewardAddress,
  };
};

const validateGlobalSettings = (
  gsPlutusData: string,
  expectedRewardsValidatorHash: string,
  expectedAtriumStakeValidatorHash: string,
) => {
  const gsDatum = deserializeDatum<any>(gsPlutusData);
  const storedStakeValidatorHash = getBytes(
    gsDatum.fields[7],
    "global settings stake_validator_hash",
  );
  const storedRewardsValidatorHash = getBytes(
    gsDatum.fields[8],
    "global settings rewards_validator_hash",
  );

  if (storedStakeValidatorHash !== StakeValidatorHash) {
    throw new Error(
      "Global settings stake_validator_hash is stale. Re-run e2e/global_settings/update_gs.ts after rebuilding the contracts.",
    );
  }

  if (storedRewardsValidatorHash !== expectedRewardsValidatorHash) {
    throw new Error(
      "Global settings rewards_validator_hash does not match the live Atrium pool. Re-run e2e/global_settings/update_gs.ts with the current Atrium pool seed.",
    );
  }

  const stakeDetails = gsDatum.fields[4].list as any[];
  const atriumStakeDetail = stakeDetails.find(
    (stakeDetail) =>
      stakeDetail.fields[1].bytes === ATRIUM_POOL_STAKE_ASSET_NAME,
  );

  if (!atriumStakeDetail) {
    throw new Error("Atrium stake_detail not found in global settings");
  }

  const storedStakeAddressDatum = getOptionValue(
    atriumStakeDetail.fields[2],
    "atrium stake_detail address",
  );
  if (storedStakeAddressDatum === null) {
    throw new Error(
      "Atrium stake_detail address is missing in global settings",
    );
  }

  const storedStakeAddress = serializeAddressObj(
    storedStakeAddressDatum as SerializedAddressObject,
    NETWORK_ID,
  );
  if (storedStakeAddress !== ATRIUM_CONFIG.stakePoolAddress) {
    throw new Error(
      "Global settings Atrium stake_detail address does not match ATRIUM_CONFIG.stakePoolAddress.",
    );
  }

  const storedAtriumStakeValidatorHash = getOptionBytes(
    atriumStakeDetail.fields[3],
    "atrium stake_detail datum_verifier_hash",
  );
  if (storedAtriumStakeValidatorHash !== expectedAtriumStakeValidatorHash) {
    throw new Error(
      "Global settings Atrium datum_verifier_hash does not match the live Atrium pool. Re-run e2e/global_settings/update_gs.ts with the current Atrium pool seed.",
    );
  }
};

const main = async (): Promise<void> => {
  const wallet1Collateral = requireWallet1Collateral();
  const gsUtxo = (
    await blockchainProvider.fetchAddressUTxOs(GlobalSettingsAddr)
  )[0];

  if (!gsUtxo) {
    throw new Error("Global settings UTxO not found");
  }

  if (!gsUtxo.output.plutusData) {
    throw new Error("Global settings datum not found");
  }

  const poolUtxos =
    await blockchainProvider.fetchAddressUTxOs(PoolValidatorAddr);
  const matchingPools = poolUtxos.flatMap((utxo) => {
    const poolPlutusData = utxo.output.plutusData;
    if (!poolPlutusData) {
      return [];
    }

    const poolData = deserializeDatum<PoolDatumType>(poolPlutusData);
    if (poolData.fields[6].bytes !== ATRIUM_POOL_STAKE_ASSET_NAME) {
      return [];
    }

    return [{ utxo, poolData }];
  });

  if (matchingPools.length === 0) {
    throw new Error("No Atrium Lava pool UTxO found");
  }

  const [{ utxo: poolUtxo, poolData }] = matchingPools;
  const poolPlutusData = poolUtxo.output.plutusData;
  if (!poolPlutusData) {
    throw new Error("Atrium Lava pool datum not found");
  }

  const poolAssetField = poolData.fields[5];
  const poolAssetIsStable = Number(poolAssetField.fields[0].constructor) === 1;
  const poolAssetPolicyId = poolAssetField.fields[1].bytes;
  const poolAssetName = poolAssetField.fields[2].bytes;
  const poolAssetMultiplier = BigInt(poolAssetField.fields[3].int);
  const poolStakeAssetName = poolData.fields[6].bytes;
  const poolDatumTotalUnderlying = BigInt(poolData.fields[2].int);
  const poolDatumTotalStAssetsMinted = BigInt(poolData.fields[1].int);

  if (poolAssetPolicyId !== "" || poolAssetName !== "") {
    throw new Error("stake_to_atrium.ts only supports the ADA Atrium pool");
  }

  const poolAsset = assetType(
    poolAssetPolicyId,
    poolAssetName,
    poolAssetMultiplier,
    poolAssetIsStable,
  );
  const poolUnderlying =
    getQuantity(poolUtxo.output.amount, "lovelace") - BigInt(MinPoolLovelace);
  if (poolUnderlying <= 0n) {
    throw new Error(
      "Atrium Lava pool has no underlying ADA available to stake",
    );
  }

  const poolNft = poolUtxo.output.amount.find(
    (asset) =>
      asset.unit.startsWith(PoolValidatorHash) && asset.unit !== "lovelace",
  );
  if (!poolNft) {
    throw new Error("Atrium Lava pool NFT not found");
  }

  const actualPoolNftName = poolNft.unit.slice(PoolValidatorHash.length);
  const {
    rewardsValidatorHash,
    rewardsValidatorAddr,
    atriumStakeValidatorScript,
    atriumStakeValidatorHash,
    atriumStakeRewardAddress,
  } = deriveAtriumScripts(actualPoolNftName);

  validateGlobalSettings(
    gsUtxo.output.plutusData,
    rewardsValidatorHash,
    atriumStakeValidatorHash,
  );

  const { basketState, stakePools } =
    await fetchBasketUtxos(blockchainProvider);
  const atriumStakePool = pickStakePoolUtxo(stakePools);
  const currentAtriumLovelace = getLovelace(atriumStakePool.utxo);
  const state = basketState.datum;

  if (state.lock.type === "Locked") {
    throw new Error(
      `Atrium basket is currently locked at ${new Date(Number(state.lock.lockedAt)).toISOString()}.`,
    );
  }

  const diffusionToMint = lovelaceToBasketTokens(state.exRate, poolUnderlying);
  if (diffusionToMint <= 0n) {
    throw new Error(
      `Pool amount too small. At the current Atrium rate (${formatExRate(state.exRate)}), ${formatLovelace(poolUnderlying)} mints 0 Diffusion.`,
    );
  }

  const updatedAtriumDatum = encodeStakePoolDatum({
    poolPkh: atriumStakePool.datum.poolPkh,
    basketTokenCounter:
      atriumStakePool.datum.basketTokenCounter + diffusionToMint,
  });
  const updatedAtriumLovelace = currentAtriumLovelace + poolUnderlying;
  const basketTokenUnit =
    ATRIUM_CONFIG.basketTokenCS + ATRIUM_CONFIG.basketTokenTN;
  const stakeRedeemer = mConStr0([poolAsset, 0]);
  const atriumStakeRedeemer = mConStr0([poolAsset, poolStakeAssetName]);

  console.log("Lava Atrium pool NFT:", actualPoolNftName);
  console.log("Predicted rewards hash:", PredictedRewardsValidatorHash);
  console.log("Actual rewards hash:", rewardsValidatorHash);
  console.log("Stake validator hash:", StakeValidatorHash);
  console.log("Atrium datum validator hash:", atriumStakeValidatorHash);
  console.log(
    "Current Lava pool total_underlying:",
    poolDatumTotalUnderlying.toString(),
  );
  console.log(
    "Current Lava pool total_st_assets_minted:",
    poolDatumTotalStAssetsMinted.toString(),
  );
  console.log("Current Atrium exchange rate:", formatExRate(state.exRate));
  console.log("Lava ADA to stake:", formatLovelace(poolUnderlying));
  console.log("Diffusion to mint:", diffusionToMint.toString());

  const unsignedTx = await txBuilder
    .readOnlyTxInReference(gsUtxo.input.txHash, gsUtxo.input.outputIndex)
    .spendingPlutusScriptV3()
    .txIn(
      poolUtxo.input.txHash,
      poolUtxo.input.outputIndex,
      poolUtxo.output.amount,
      poolUtxo.output.address,
    )
    .spendingTxInReference(
      poolScriptTxHash,
      poolScriptTxIdx,
      undefined,
      PoolValidatorHash,
    )
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue(POOL_STAKE_REDEEMER)
    .withdrawalPlutusScriptV3()
    .withdrawal(StakeRewardAddress, "0")
    .withdrawalScript(StakeValidatorScript)
    .withdrawalRedeemerValue(stakeRedeemer)
    .withdrawalPlutusScriptV3()
    .withdrawal(atriumStakeRewardAddress, "0")
    .withdrawalScript(atriumStakeValidatorScript)
    .withdrawalRedeemerValue(atriumStakeRedeemer)
    .spendingPlutusScriptV2()
    .txIn(
      atriumStakePool.utxo.input.txHash,
      atriumStakePool.utxo.input.outputIndex,
      atriumStakePool.utxo.output.amount,
      atriumStakePool.utxo.output.address,
    )
    .txInInlineDatumPresent()
    .txInRedeemerValue(ATRIUM_DEPOSIT_REDEEMER, "JSON")
    .spendingTxInReference(
      ATRIUM_CONFIG.refScriptTxHash,
      ATRIUM_CONFIG.refScriptTxIndex,
    )
    .readOnlyTxInReference(
      basketState.utxo.input.txHash,
      basketState.utxo.input.outputIndex,
    )
    .txInDatumValue(basketState.rawDatumCbor, "CBOR")
    .mintPlutusScriptV2()
    .mint(
      diffusionToMint.toString(),
      ATRIUM_CONFIG.basketTokenCS,
      ATRIUM_CONFIG.basketTokenTN,
    )
    .mintingScript(applyCslParamsToScript(ATRIUM_CONFIG.basketTokenMPCbor, []))
    .mintRedeemerValue(ATRIUM_DEPOSIT_REDEEMER, "JSON")
    .txOut(PoolValidatorAddr, [
      { unit: "lovelace", quantity: String(MinPoolLovelace) },
      { unit: poolNft.unit, quantity: "1" },
    ])
    .txOutInlineDatumValue(poolPlutusData, "CBOR")
    .txOut(atriumStakePool.utxo.output.address, [
      { unit: "lovelace", quantity: updatedAtriumLovelace.toString() },
      { unit: STAKE_POOL_UNIT, quantity: "1" },
    ])
    .txOutInlineDatumValue(updatedAtriumDatum, "JSON")
    .txOut(rewardsValidatorAddr, [
      { unit: "lovelace", quantity: REWARD_OUTPUT_LOVELACE.toString() },
      { unit: basketTokenUnit, quantity: diffusionToMint.toString() },
    ])
    .metadataValue(674, { msg: ["Stake Lava Atrium pool into Atrium"] })
    .txInCollateral(
      wallet1Collateral.input.txHash,
      wallet1Collateral.input.outputIndex,
    )
    .requiredSignerHash(wallet1VK)
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .complete();

  const signedTx = await wallet1.signTx(unsignedTx);
  const txHash = await wallet1.submitTx(signedTx);

  console.log("Stake to atrium tx hash:", txHash);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
