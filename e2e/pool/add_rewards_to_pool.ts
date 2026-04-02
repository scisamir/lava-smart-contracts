import {
  deserializeDatum,
  mConStr0,
  mConStr1,
  mConStr3,
  type Asset,
} from "@meshsdk/core";
import { assetType, poolDatum } from "../data.js";
import { GlobalSettingsAddr } from "../global_settings/validator.js";
import {
  ATRIUM_POOL_STAKE_ASSET_NAME,
  PrecisionFactor,
  blockchainProvider,
  poolScriptTxHash,
  poolScriptTxIdx,
  txBuilder,
  wallet1,
  wallet1Address,
  wallet1Utxos,
  wallet1VK,
  requireWallet1Collateral,
} from "../setup.js";
import {
  RewardsValidatorAddr,
  RewardsValidatorHash,
  RewardsValidatorScript,
} from "../rewards/validator.js";
import { PoolDatumType } from "../types.js";
import { PoolValidatorAddr, PoolValidatorHash } from "./validator.js";

const ADD_REWARDS_BATCHER_INDEX = 0;
const ADD_REWARDS_POOL_REDEEMER = mConStr3([]);

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

const getInteger = (value: unknown, label: string): bigint => {
  if (
    typeof value === "object" &&
    value !== null &&
    "int" in value &&
    (typeof (value as { int: unknown }).int === "number" ||
      typeof (value as { int: unknown }).int === "bigint" ||
      typeof (value as { int: unknown }).int === "string")
  ) {
    return BigInt((value as { int: string | number | bigint }).int);
  }

  throw new Error(`Expected integer for ${label}`);
};

const getList = (value: unknown, label: string): unknown[] => {
  if (
    typeof value === "object" &&
    value !== null &&
    "list" in value &&
    Array.isArray((value as { list: unknown[] }).list)
  ) {
    return (value as { list: unknown[] }).list;
  }

  throw new Error(`Expected list for ${label}`);
};

const getConstructor = (value: unknown, label: string): number => {
  if (
    typeof value === "object" &&
    value !== null &&
    "constructor" in value &&
    (typeof (value as { constructor: unknown }).constructor === "number" ||
      typeof (value as { constructor: unknown }).constructor === "bigint" ||
      typeof (value as { constructor: unknown }).constructor === "string")
  ) {
    return Number(
      (value as { constructor: string | number | bigint }).constructor,
    );
  }

  throw new Error(`Expected constructor for ${label}`);
};

const getBool = (value: unknown, label: string): boolean => {
  const constructor = getConstructor(value, label);

  if (constructor === 0) {
    return false;
  }

  if (constructor === 1) {
    return true;
  }

  throw new Error(`Invalid boolean constructor for ${label}: ${constructor}`);
};

const isVerificationKeySigner = (
  value: unknown,
  verificationKeyHash: string,
): boolean => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("fields" in value) ||
    !Array.isArray((value as { fields: unknown[] }).fields)
  ) {
    return false;
  }

  if (getConstructor(value, "authorized batcher") !== 0) {
    return false;
  }

  return (
    getBytes(
      (value as { fields: unknown[] }).fields[0],
      "authorized batcher verification key hash",
    ) === verificationKeyHash
  );
};

const hasOnlyLovelace = (assets: Asset[]): boolean =>
  assets.every(
    (asset) => asset.unit === "lovelace" || BigInt(asset.quantity) === 0n,
  );

const isSameUtxo = (
  left: { txHash: string; outputIndex: number },
  right: { txHash: string; outputIndex: number },
): boolean =>
  left.txHash === right.txHash && left.outputIndex === right.outputIndex;

const main = async (): Promise<void> => {
  const wallet1Collateral = requireWallet1Collateral();
  const wallet1FeeUtxos = wallet1Utxos.filter(
    (utxo) =>
      hasOnlyLovelace(utxo.output.amount) &&
      !isSameUtxo(utxo.input, wallet1Collateral.input),
  );

  if (wallet1FeeUtxos.length === 0) {
    throw new Error(
      "No extra pure ADA wallet UTxO found for fees. Send 2-5 ADA to the wallet in a separate UTxO and retry.",
    );
  }

  const gsUtxo = (
    await blockchainProvider.fetchAddressUTxOs(GlobalSettingsAddr)
  )[0];

  if (!gsUtxo) {
    throw new Error("Global settings UTxO not found");
  }

  if (!gsUtxo.output.plutusData) {
    throw new Error("Global settings datum not found");
  }

  const gsDatum = deserializeDatum<any>(gsUtxo.output.plutusData);
  const authorizedBatchers = getList(
    gsDatum.fields[1],
    "global settings authorized_batchers",
  );
  const batcher = authorizedBatchers[ADD_REWARDS_BATCHER_INDEX];
  if (!batcher) {
    throw new Error(
      `No authorized batcher at index ${ADD_REWARDS_BATCHER_INDEX}`,
    );
  }

  if (!isVerificationKeySigner(batcher, wallet1VK)) {
    throw new Error(
      `Authorized batcher ${ADD_REWARDS_BATCHER_INDEX} is not wallet1. Update the script or global settings before continuing.`,
    );
  }

  const configuredRewardsValidatorHash = getBytes(
    gsDatum.fields[8],
    "global settings rewards_validator_hash",
  );
  if (configuredRewardsValidatorHash !== RewardsValidatorHash) {
    throw new Error(
      "Global settings rewards_validator_hash does not match the live Atrium rewards validator. Re-run e2e/global_settings/update_gs.ts with the current Atrium pool seed.",
    );
  }

  const minPoolLovelace = getInteger(
    gsDatum.fields[9],
    "global settings min_pool_lovelace",
  );

  const poolUtxos =
    await blockchainProvider.fetchAddressUTxOs(PoolValidatorAddr);
  const matchingPools = poolUtxos.flatMap((utxo) => {
    const poolPlutusData = utxo.output.plutusData;
    if (!poolPlutusData) {
      return [];
    }

    const poolData = deserializeDatum<PoolDatumType>(poolPlutusData);
    if (
      getBytes(poolData.fields[6], "pool_stake_asset_name") !==
      ATRIUM_POOL_STAKE_ASSET_NAME
    ) {
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
  const poolNft = poolUtxo.output.amount.find(
    (asset) =>
      asset.unit.startsWith(PoolValidatorHash) && asset.unit !== "lovelace",
  );
  if (!poolNft) {
    throw new Error("Atrium Lava pool NFT not found");
  }

  const unexpectedPoolAssets = poolUtxo.output.amount.filter(
    (asset) =>
      BigInt(asset.quantity) > 0n &&
      asset.unit !== "lovelace" &&
      asset.unit !== poolNft.unit,
  );
  if (unexpectedPoolAssets.length > 0) {
    throw new Error(
      "Atrium Lava pool UTxO contains unexpected assets. This script only supports the ADA Atrium pool path.",
    );
  }

  const poolAssetField = poolData.fields[5];
  const poolAssetIsStable = getBool(
    poolAssetField.fields[0],
    "pool asset is_stable",
  );
  const poolAssetPolicyId = getBytes(
    poolAssetField.fields[1],
    "pool asset policy_id",
  );
  const poolAssetName = getBytes(
    poolAssetField.fields[2],
    "pool asset asset_name",
  );
  const poolAssetMultiplier = getInteger(
    poolAssetField.fields[3],
    "pool asset multiplier",
  );

  if (poolAssetPolicyId !== "" || poolAssetName !== "") {
    throw new Error(
      "add_rewards_to_pool.ts only supports the root ADA Atrium pool",
    );
  }

  const poolAsset = assetType(
    poolAssetPolicyId,
    poolAssetName,
    poolAssetMultiplier,
    poolAssetIsStable,
  );
  const currentTotalStAssetsMinted = getInteger(
    poolData.fields[1],
    "pool total_st_assets_minted",
  );
  const currentTotalUnderlying = getInteger(
    poolData.fields[2],
    "pool total_underlying",
  );
  const currentExchangeRate = getInteger(
    poolData.fields[3],
    "pool exchange_rate",
  );
  const currentTotalRewardsAccrued = getInteger(
    poolData.fields[4],
    "pool total_rewards_accrued",
  );
  const poolStakeAssetName = getBytes(
    poolData.fields[6],
    "pool stake asset name",
  );
  const isProcessingOpen = getBool(
    poolData.fields[7],
    "pool is_processing_open",
  );

  const rewardUtxos =
    await blockchainProvider.fetchAddressUTxOs(RewardsValidatorAddr);
  const pureAdaRewardCandidates = rewardUtxos
    .flatMap((utxo) => {
      if (!hasOnlyLovelace(utxo.output.amount)) {
        return [];
      }

      const rewardLovelace = getQuantity(utxo.output.amount, "lovelace");
      if (rewardLovelace <= 0n) {
        return [];
      }

      return [{ utxo, rewardLovelace }];
    })
    .sort((left, right) =>
      left.rewardLovelace === right.rewardLovelace
        ? 0
        : left.rewardLovelace > right.rewardLovelace
          ? -1
          : 1,
    );

  if (pureAdaRewardCandidates.length === 0) {
    const tokenBearingRewardUtxo = rewardUtxos.find(
      (utxo) => !hasOnlyLovelace(utxo.output.amount),
    );

    if (tokenBearingRewardUtxo) {
      throw new Error(
        "No pure ADA rewards UTxO found. If the rewards UTxO still carries Diffusion, run e2e/pool/withdraw_from_atrium.ts first.",
      );
    }

    throw new Error("No pure ADA rewards UTxO found at the rewards validator");
  }

  const [{ utxo: rewardUtxo, rewardLovelace }] = pureAdaRewardCandidates;
  const updatedPoolLovelace =
    getQuantity(poolUtxo.output.amount, "lovelace") + rewardLovelace;
  const poolOutAmount = updatedPoolLovelace - minPoolLovelace;
  if (poolOutAmount < 0n) {
    throw new Error(
      "Updated pool lovelace would fall below min_pool_lovelace. Check the current pool UTxO and global settings datum.",
    );
  }

  const rewardsAccrued = poolOutAmount - currentTotalUnderlying;
  if (rewardsAccrued > 0n && currentTotalStAssetsMinted <= 0n) {
    throw new Error(
      "Pool has zero stAssets minted, so AddRewards would divide by zero when recomputing exchange_rate.",
    );
  }

  const updatedTotalUnderlying =
    rewardsAccrued > 0n
      ? currentTotalUnderlying + rewardsAccrued
      : currentTotalUnderlying;
  const updatedExchangeRate =
    rewardsAccrued > 0n
      ? (updatedTotalUnderlying * BigInt(PrecisionFactor)) /
        currentTotalStAssetsMinted
      : currentExchangeRate;
  const updatedTotalRewardsAccrued =
    rewardsAccrued > 0n
      ? currentTotalRewardsAccrued + rewardsAccrued
      : currentTotalRewardsAccrued;
  const addRewardsRedeemer = mConStr0([poolAsset, ADD_REWARDS_BATCHER_INDEX]);
  const shouldReuseExistingDatum = rewardsAccrued <= 0n;
  const updatedPoolDatum = shouldReuseExistingDatum
    ? undefined
    : poolDatum(
        poolData.fields[0],
        currentTotalStAssetsMinted,
        updatedTotalUnderlying,
        updatedExchangeRate,
        updatedTotalRewardsAccrued,
        poolAsset,
        poolStakeAssetName,
        isProcessingOpen,
      );

  console.log(
    "Selected rewards UTxO:",
    `${rewardUtxo.input.txHash}#${rewardUtxo.input.outputIndex}`,
  );
  console.log("Rewards validator hash:", RewardsValidatorHash);
  console.log(
    "Current pool total_underlying:",
    currentTotalUnderlying.toString(),
  );
  console.log(
    "Current pool total_st_assets_minted:",
    currentTotalStAssetsMinted.toString(),
  );
  console.log("Returned ADA:", rewardLovelace.toString());
  console.log("Rewards accrued:", rewardsAccrued.toString());
  console.log("Updated total_underlying:", updatedTotalUnderlying.toString());
  console.log("Updated exchange_rate:", updatedExchangeRate.toString());
  console.log(
    "Pool datum action:",
    shouldReuseExistingDatum ? "reused existing datum" : "rebuilt datum",
  );

  const unsignedTx = await txBuilder
    .readOnlyTxInReference(gsUtxo.input.txHash, gsUtxo.input.outputIndex)
    .spendingPlutusScriptV3()
    .txIn(
      rewardUtxo.input.txHash,
      rewardUtxo.input.outputIndex,
      rewardUtxo.output.amount,
      rewardUtxo.output.address,
    )
    .txInScript(RewardsValidatorScript)
    .txInInlineDatumPresent()
    .txInRedeemerValue(addRewardsRedeemer)
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
    .spendingReferenceTxInRedeemerValue(ADD_REWARDS_POOL_REDEEMER)
    .txOut(PoolValidatorAddr, [
      { unit: "lovelace", quantity: updatedPoolLovelace.toString() },
      { unit: poolNft.unit, quantity: "1" },
    ])
    .txOutInlineDatumValue(
      shouldReuseExistingDatum ? poolPlutusData : updatedPoolDatum!,
      shouldReuseExistingDatum ? "CBOR" : "Mesh",
    )
    .metadataValue(674, { msg: ["Add withdrawn Atrium rewards back to pool"] })
    .txInCollateral(
      wallet1Collateral.input.txHash,
      wallet1Collateral.input.outputIndex,
    )
    .setTotalCollateral("5000000")
    .requiredSignerHash(wallet1VK)
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1FeeUtxos)
    .complete();

  const signedTx = await wallet1.signTx(unsignedTx);
  const txHash = await wallet1.submitTx(signedTx);

  console.log("Add rewards to pool tx hash:", txHash);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
