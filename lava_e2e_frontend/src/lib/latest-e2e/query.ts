import {
  applyParamsToScript,
  builtinByteString,
  deserializeDatum,
  resolveScriptHash,
  scriptAddress,
  serializePlutusScript,
  serializeRewardAddress,
  type Asset,
  type UTxO,
} from "@meshsdk/core";
import {
  BASKET_TOKEN_UNIT,
  CONFIG as ATRIUM_CONFIG,
} from "../../generated/atrium_mainnet/config";
import { basketTokensToLovelace } from "../../generated/atrium_mainnet/math";
import {
  fetchBasketUtxos,
  getLovelace,
  pickStakePoolUtxo,
} from "../../generated/atrium_mainnet/queries";
import {
  ATRIUM_POOL_STAKE_ASSET_NAME,
  GlobalSettingsAddr,
  GlobalSettingsHash,
  MintingHash,
  NETWORK,
  NETWORK_ID,
  OrderValidatorAddr,
  PoolValidatorAddr,
  PoolValidatorHash,
  StakeValidatorHash,
  createTestingProvider,
} from "./contracts";
import {
  getBytesList,
  getBytesValue,
  getConstructorValue,
  getFields,
  getIntValue,
  getOptionBytes,
  getOptionValue,
  formatExchangeRate,
  getQuantity,
  parseBasketLockLabel,
  serializeTestingAddress,
  type AddressValue,
  type DatumValue,
} from "./helpers";
import type {
  AtriumSnapshot,
  AtriumOrder,
  PoolSnapshot,
  SnapshotOrder,
  TestingSnapshot,
} from "./types";
import blueprint from "../../generated/plutus.json" with { type: "json" };
import derivedArtifacts from "../../generated/latest-e2e-derived.json" with { type: "json" };

type DerivedArtifacts = {
  atriumPoolNftName: string;
  rewardsValidatorScript: string;
  rewardsValidatorHash: string;
  rewardsValidatorAddr: string;
  atriumStakeValidatorScript: string;
  atriumStakeValidatorHash: string;
  atriumStakeRewardAddress: string;
  atriumSwapValidatorScript: string;
  atriumSwapValidatorHash: string;
  atriumSwapRewardAddress: string;
};

const LIVE_DERIVED_ARTIFACTS = derivedArtifacts as DerivedArtifacts;

type GlobalSettingsState = {
  utxo: UTxO;
  rewardsValidatorHash: string;
  rewardsValidatorAddr: string;
  authorizedSwapScripts: string[];
  plutusData: string;
};

type StakeGlobalSettingsValidation = {
  requiresOnChainVerifierScript: boolean;
  storedAtriumStakeValidatorHash: string;
};

const requireValidatorCode = (title: string) => {
  const validator = (blueprint as { validators: Array<{ title: string; compiledCode: string }> })
    .validators.find((item) => item.title === title);

  if (!validator) {
    throw new Error(`Validator not found in blueprint: ${title}`);
  }

  return validator.compiledCode;
};

export const fetchGlobalSettingsUtxo = async () => {
  const provider = createTestingProvider();
  const gsUtxo = (await provider.fetchAddressUTxOs(GlobalSettingsAddr))[0];

  if (!gsUtxo || !gsUtxo.output.plutusData) {
    throw new Error("Global settings UTxO or datum not found.");
  }

  return gsUtxo;
};

const parseGlobalSettingsState = (gsUtxo: UTxO): GlobalSettingsState => {
  const plutusData = gsUtxo.output.plutusData;
  if (!plutusData) {
    throw new Error("Global settings datum not found.");
  }

  const gsDatum = deserializeDatum<DatumValue>(plutusData);
  const gsFields = getFields(gsDatum, "global settings");

  return {
    utxo: gsUtxo,
    rewardsValidatorHash: getBytesValue(
      gsFields[8],
      "global settings rewards validator hash",
    ),
    rewardsValidatorAddr: serializeTestingAddress(gsFields[5] as AddressValue),
    authorizedSwapScripts: getBytesList(
      gsFields[6],
      "global settings authorized swap scripts",
    ),
    plutusData,
  };
};

export const fetchGlobalSettingsState = async () =>
  parseGlobalSettingsState(await fetchGlobalSettingsUtxo());

export const deriveRewardsArtifacts = (poolNftName: string) => {
  if (poolNftName === LIVE_DERIVED_ARTIFACTS.atriumPoolNftName) {
    return {
      rewardsValidatorScript: LIVE_DERIVED_ARTIFACTS.rewardsValidatorScript,
      rewardsValidatorHash: LIVE_DERIVED_ARTIFACTS.rewardsValidatorHash,
      rewardsValidatorAddr: LIVE_DERIVED_ARTIFACTS.rewardsValidatorAddr,
    };
  }

  const rewardsValidatorScript = applyParamsToScript(
    requireValidatorCode("rewards.rewards_validator.spend"),
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

  return {
    rewardsValidatorScript,
    rewardsValidatorHash,
    rewardsValidatorAddr,
  };
};

export const deriveAtriumStakeArtifacts = (poolNftName: string) => {
  const { rewardsValidatorHash, rewardsValidatorAddr } =
    deriveRewardsArtifacts(poolNftName);
  const atriumStakeArtifacts =
    deriveAtriumStakeArtifactsFromRewardsHash(rewardsValidatorHash);

  return {
    rewardsValidatorHash,
    rewardsValidatorAddr,
    ...atriumStakeArtifacts,
  };
};

export const deriveAtriumStakeArtifactsFromRewardsHash = (
  rewardsValidatorHash: string,
) => {
  if (rewardsValidatorHash === LIVE_DERIVED_ARTIFACTS.rewardsValidatorHash) {
    return {
      atriumStakeValidatorScript:
        LIVE_DERIVED_ARTIFACTS.atriumStakeValidatorScript,
      atriumStakeValidatorHash:
        LIVE_DERIVED_ARTIFACTS.atriumStakeValidatorHash,
      atriumStakeRewardAddress:
        LIVE_DERIVED_ARTIFACTS.atriumStakeRewardAddress,
    };
  }

  const atriumStakeValidatorScript = applyParamsToScript(
    requireValidatorCode("stake_datums/atrium.atrium.withdraw"),
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
    atriumStakeValidatorScript,
    atriumStakeValidatorHash,
    atriumStakeRewardAddress,
  };
};

export const deriveAtriumSwapArtifacts = (poolNftName: string) => {
  const {
    rewardsValidatorScript,
    rewardsValidatorHash,
    rewardsValidatorAddr,
  } = deriveRewardsArtifacts(poolNftName);
  const atriumSwapArtifacts =
    deriveAtriumSwapArtifactsFromRewardsHash(rewardsValidatorHash);

  return {
    rewardsValidatorScript,
    rewardsValidatorHash,
    rewardsValidatorAddr,
    ...atriumSwapArtifacts,
  };
};

export const deriveAtriumSwapArtifactsFromRewardsHash = (
  rewardsValidatorHash: string,
) => {
  if (rewardsValidatorHash === LIVE_DERIVED_ARTIFACTS.rewardsValidatorHash) {
    return {
      atriumSwapValidatorScript:
        LIVE_DERIVED_ARTIFACTS.atriumSwapValidatorScript,
      atriumSwapValidatorHash:
        LIVE_DERIVED_ARTIFACTS.atriumSwapValidatorHash,
      atriumSwapRewardAddress:
        LIVE_DERIVED_ARTIFACTS.atriumSwapRewardAddress,
    };
  }

  const atriumSwapValidatorScript = applyParamsToScript(
    requireValidatorCode("swap_validators/atrium_swap.atrium_swap.withdraw"),
    [
      builtinByteString(ATRIUM_CONFIG.basketTokenCS),
      scriptAddress(rewardsValidatorHash),
    ],
    "JSON",
  );
  const atriumSwapValidatorHash = resolveScriptHash(
    atriumSwapValidatorScript,
    "V3",
  );
  const atriumSwapRewardAddress = serializeRewardAddress(
    atriumSwapValidatorHash,
    true,
    NETWORK_ID,
  );

  return {
    atriumSwapValidatorScript,
    atriumSwapValidatorHash,
    atriumSwapRewardAddress,
  };
};

const hasUnexpectedRewardAsset = (utxo: { output: { amount: Asset[] } }) =>
  utxo.output.amount.some(
    (asset: Asset) =>
      BigInt(asset.quantity) > 0n &&
      asset.unit !== "lovelace" &&
      asset.unit !== BASKET_TOKEN_UNIT,
  );

type RewardCandidate = {
  ref: string;
  diffusionAmount: bigint;
  rewardLovelace: bigint;
};

const getOrderView = (utxo: UTxO): AtriumOrder | null => {
  if (!utxo.output.plutusData) {
    return null;
  }

  const orderData = deserializeDatum<DatumValue>(utxo.output.plutusData);
  const orderFields = getFields(orderData, "order datum");

  if (
    getBytesValue(orderFields[3], "order pool stake asset") !==
    ATRIUM_POOL_STAKE_ASSET_NAME
  ) {
    return null;
  }

  const orderType = orderFields[0];
  const orderTypeFields = getFields(orderType, "order type");

  return {
    id: `${utxo.input.txHash}#${utxo.input.outputIndex}`,
    txHash: utxo.input.txHash,
    outputIndex: utxo.input.outputIndex,
    kind: getConstructorValue(orderType, "order type") === 0 ? "deposit" : "redeem",
    amount: getIntValue(orderTypeFields[0], "order amount"),
    receiverAddress: serializeTestingAddress(orderFields[1] as AddressValue),
    wrapperLovelace: getQuantity(utxo.output.amount, "lovelace"),
    stakeLocked: getQuantity(
      utxo.output.amount,
      MintingHash + ATRIUM_POOL_STAKE_ASSET_NAME,
    ),
    utxo,
  };
};

export const fetchAtriumOrders = async () => {
  const provider = createTestingProvider();
  const orderUtxos = await provider.fetchAddressUTxOs(OrderValidatorAddr);
  return orderUtxos
    .map(getOrderView)
    .filter((order: AtriumOrder | null): order is AtriumOrder => Boolean(order));
};

export const fetchAtriumPoolState = async () => {
  const provider = createTestingProvider();
  const gsUtxo = (await provider.fetchAddressUTxOs(GlobalSettingsAddr))[0];
  const poolUtxos = await provider.fetchAddressUTxOs(PoolValidatorAddr);
  const configuredRewardsValidatorHash =
    gsUtxo?.output.plutusData
      ? getBytesValue(
          getFields(
            deserializeDatum<DatumValue>(gsUtxo.output.plutusData),
            "global settings",
          )[8],
          "global settings rewards validator hash",
        )
      : null;
  const matchingPools = poolUtxos.flatMap((utxo) => {
    if (!utxo.output.plutusData) {
      return [];
    }

    const poolData = deserializeDatum<DatumValue>(utxo.output.plutusData);
    const poolFields = getFields(poolData, "pool datum");

    if (
      getBytesValue(poolFields[6], "pool stake asset name") !==
      ATRIUM_POOL_STAKE_ASSET_NAME
    ) {
      return [];
    }

    const poolNft = utxo.output.amount.find(
      (asset: Asset) =>
        asset.unit.startsWith(PoolValidatorHash) && asset.unit !== "lovelace",
    );

    if (!poolNft) {
      throw new Error("Atrium Lava pool NFT not found on-chain.");
    }

    const snapshot: PoolSnapshot = {
      txRef: `${utxo.input.txHash}#${utxo.input.outputIndex}`,
      nftUnit: poolNft.unit,
      nftName: poolNft.unit.slice(PoolValidatorHash.length),
      totalUnderlying: getIntValue(poolFields[2], "pool total underlying"),
      totalStAssetsMinted: getIntValue(
        poolFields[1],
        "pool total stake assets",
      ),
      exchangeRate: getIntValue(poolFields[3], "pool exchange rate"),
      totalRewardsAccrued: getIntValue(
        poolFields[4],
        "pool rewards accrued",
      ),
      availableToStake: (() => {
        const lovelace = getQuantity(utxo.output.amount, "lovelace");
        return lovelace > 5_000_000n ? lovelace - 5_000_000n : 0n;
      })(),
      isProcessingOpen:
        getConstructorValue(poolFields[7], "pool processing flag") === 1,
    };

    return [{
      snapshot,
      utxo,
      datum: poolData,
      rewardsValidatorHash: deriveRewardsArtifacts(snapshot.nftName)
        .rewardsValidatorHash,
    }];
  });

  if (matchingPools.length === 0) {
    throw new Error("No Atrium Lava pool UTxO found.");
  }

  if (configuredRewardsValidatorHash) {
    const configuredPool = matchingPools.find(
      (pool) => pool.rewardsValidatorHash === configuredRewardsValidatorHash,
    );

    if (configuredPool) {
      return {
        snapshot: configuredPool.snapshot,
        utxo: configuredPool.utxo,
        datum: configuredPool.datum,
      };
    }

    if (matchingPools.length > 1) {
      throw new Error(
        "Multiple LADA pools were found, but none matches global settings rewards_validator_hash. The frontend cannot tell which live pool should be treated as Atrium.",
      );
    }
  }

  return {
    snapshot: matchingPools[0].snapshot,
    utxo: matchingPools[0].utxo,
    datum: matchingPools[0].datum,
  };
};

export const validateStakeGlobalSettings = (
  gsPlutusData: string,
  expectedAtriumStakeValidatorHash: string,
): StakeGlobalSettingsValidation => {
  const gsDatum = deserializeDatum<DatumValue>(gsPlutusData);
  const gsFields = getFields(gsDatum, "global settings");
  const storedStakeValidatorHash = getBytesValue(
    gsFields[7],
    "global settings stake validator hash",
  );

  if (storedStakeValidatorHash !== StakeValidatorHash) {
    throw new Error(
      "Global settings stake_validator_hash is stale. Re-run e2e/global_settings/update_gs.ts after rebuilding the contracts.",
    );
  }

  const stakeDetails = Array.isArray(gsFields[4].list) ? gsFields[4].list : [];
  const atriumStakeDetail = stakeDetails.find(
    (stakeDetail: DatumValue) =>
      getBytesValue(
        getFields(stakeDetail, "stake detail")[1],
        "stake detail asset name",
      ) === ATRIUM_POOL_STAKE_ASSET_NAME,
  );

  if (!atriumStakeDetail) {
    throw new Error("Atrium stake detail not found in global settings.");
  }

  const detailFields = getFields(atriumStakeDetail, "atrium stake detail");
  const storedStakeAddressDatum = getOptionValue(
    detailFields[2],
    "atrium stake detail address",
  );
  if (!storedStakeAddressDatum) {
    throw new Error("Atrium stake detail address is missing.");
  }

  const storedStakeAddress = serializeTestingAddress(
    storedStakeAddressDatum as AddressValue,
  );
  if (storedStakeAddress !== ATRIUM_CONFIG.stakePoolAddress) {
    throw new Error(
      "Global settings Atrium stake detail address is stale. Re-run e2e/global_settings/update_gs.ts with the current Atrium pool seed.",
    );
  }

  const storedAtriumStakeValidatorHash = getOptionBytes(
    detailFields[3],
    "atrium stake detail verifier hash",
  );
  if (!storedAtriumStakeValidatorHash) {
    throw new Error(
      "Atrium stake detail verifier hash is missing.",
    );
  }

  return {
    requiresOnChainVerifierScript:
      storedAtriumStakeValidatorHash !== expectedAtriumStakeValidatorHash,
    storedAtriumStakeValidatorHash,
  };
};

export const validateSwapGlobalSettings = (
  gsPlutusData: string,
  expectedAtriumSwapValidatorHash: string,
) => {
  const gsDatum = deserializeDatum<DatumValue>(gsPlutusData);
  const gsFields = getFields(gsDatum, "global settings");
  const storedAuthorizedSwapScripts = getBytesList(
    gsFields[6],
    "global settings authorized swap scripts",
  );

  if (!storedAuthorizedSwapScripts.includes(expectedAtriumSwapValidatorHash)) {
    throw new Error(
      `The local Atrium swap validator script does not match global settings. Authorized=${storedAuthorizedSwapScripts.join(",")}, local=${expectedAtriumSwapValidatorHash}. Restart lava_e2e_frontend so it reloads the latest synced contracts. Re-run e2e/global_settings/update_gs.ts only if the mismatch remains after restart.`,
    );
  }
};

const withSnapshotStage = async <T>(
  label: string,
  run: () => Promise<T>,
): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label}: ${message}`);
  }
};

const withSnapshotStageSync = <T>(label: string, run: () => T): T => {
  try {
    return run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label}: ${message}`);
  }
};

const withSnapshotSummaryFallback = <T>(
  warnings: string[],
  label: string,
  fallback: T,
  run: () => T,
): T => {
  try {
    return run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`Snapshot ${label} fallback: ${message}`);
    return fallback;
  }
};

const toSnapshotOrder = (order: AtriumOrder): SnapshotOrder => ({
  id: order.id,
  txHash: order.txHash,
  outputIndex: String(order.outputIndex),
  kind: order.kind,
  amount: order.amount,
  receiverAddress: order.receiverAddress,
  wrapperLovelace: order.wrapperLovelace,
});

export const fetchTestingSnapshot = async (
  userAddress?: string,
): Promise<TestingSnapshot> => {
  const provider = createTestingProvider();
  const warnings: string[] = [];
  const orders = await withSnapshotStage("orders", fetchAtriumOrders);
  const userOrders = userAddress
    ? orders.filter((order: AtriumOrder) => order.receiverAddress === userAddress)
    : [];
  const gsState = await withSnapshotStage(
    "global settings",
    fetchGlobalSettingsState,
  );
  const pool = await withSnapshotStage("pool", fetchAtriumPoolState);
  const { basketState, stakePools } = await withSnapshotStage(
    "atrium basket",
    () => fetchBasketUtxos(provider),
  );
  const atriumStakePool = pickStakePoolUtxo(stakePools);
  const rewardUtxos = await withSnapshotStage("rewards", () =>
    provider.fetchAddressUTxOs(gsState.rewardsValidatorAddr),
  );

  const rewardCandidates = rewardUtxos
    .flatMap((utxo: UTxO): RewardCandidate[] => {
      const diffusionAmount = getQuantity(utxo.output.amount, BASKET_TOKEN_UNIT);
      if (diffusionAmount <= 0n || hasUnexpectedRewardAsset(utxo)) {
        return [];
      }

      return [
        {
          ref: `${utxo.input.txHash}#${utxo.input.outputIndex}`,
          diffusionAmount,
          rewardLovelace: getQuantity(utxo.output.amount, "lovelace"),
        },
      ];
    })
    .sort((left: RewardCandidate, right: RewardCandidate) =>
      left.diffusionAmount === right.diffusionAmount
        ? 0
        : left.diffusionAmount > right.diffusionAmount
          ? -1
          : 1,
    );

  const selectedReward = rewardCandidates[0] ?? null;
  if (!selectedReward) {
    warnings.push("No pure Atrium Diffusion rewards UTxO is currently available.");
  }

  const snapshotUserOrders = withSnapshotSummaryFallback(
    warnings,
    "user orders",
    [] as SnapshotOrder[],
    () => userOrders.map(toSnapshotOrder),
  );

  const orderStats = withSnapshotSummaryFallback(
    warnings,
    "order stats",
    {
      totalPending: 0,
      depositCount: 0,
      redeemCount: 0,
      totalDepositAmount: 0n,
      totalRedeemAmount: 0n,
    },
    () => ({
      totalPending: orders.length,
      depositCount: orders.filter((order: AtriumOrder) => order.kind === "deposit").length,
      redeemCount: orders.filter((order: AtriumOrder) => order.kind === "redeem").length,
      totalDepositAmount: orders
        .filter((order: AtriumOrder) => order.kind === "deposit")
        .reduce((sum: bigint, order: AtriumOrder) => sum + order.amount, 0n),
      totalRedeemAmount: orders
        .filter((order: AtriumOrder) => order.kind === "redeem")
        .reduce((sum: bigint, order: AtriumOrder) => sum + order.amount, 0n),
    }),
  );

  const poolSnapshot = withSnapshotSummaryFallback(
    warnings,
    "pool summary",
    {
      ...pool.snapshot,
      totalUnderlying: 0n,
      totalStAssetsMinted: 0n,
      availableToStake: 0n,
    } satisfies PoolSnapshot,
    () => ({
      ...pool.snapshot,
      totalUnderlying: pool.snapshot.totalUnderlying,
      totalStAssetsMinted: pool.snapshot.totalStAssetsMinted,
      availableToStake: pool.snapshot.availableToStake,
    }),
  );

  const atriumSnapshotFallback: AtriumSnapshot = {
    basketExchangeRateLabel: "Unavailable",
    basketLockLabel: "Unavailable",
    pledgeLockLabel: "Unavailable",
    rewardDiffusion: 0n,
    rewardWrapperLovelace: 0n,
    estimatedAdaFromRewards: 0n,
    basketTokenCounter: 0n,
    stakePoolLovelace: 0n,
    selectedRewardRef: null,
  };

  const atriumSnapshot = withSnapshotSummaryFallback<AtriumSnapshot>(
    warnings,
    "atrium summary",
    atriumSnapshotFallback,
    () => ({
      basketExchangeRateLabel: formatExchangeRate(basketState.datum.exRate),
      basketLockLabel: parseBasketLockLabel(basketState.datum.lock),
      pledgeLockLabel: parseBasketLockLabel(basketState.datum.pledgeLock),
      rewardDiffusion: selectedReward?.diffusionAmount ?? 0n,
      rewardWrapperLovelace: selectedReward?.rewardLovelace ?? 0n,
      estimatedAdaFromRewards: selectedReward
        ? basketTokensToLovelace(
            basketState.datum.exRate,
            selectedReward.diffusionAmount,
          )
        : 0n,
      basketTokenCounter: atriumStakePool.datum.basketTokenCounter,
      stakePoolLovelace: getLovelace(atriumStakePool.utxo),
      selectedRewardRef: selectedReward?.ref ?? null,
    }),
  );

  return withSnapshotStageSync("summary", () => ({
    network: NETWORK,
    userOrders: snapshotUserOrders,
    orderStats,
    pool: poolSnapshot,
    atrium: atriumSnapshot,
    warnings,
  }));
};
