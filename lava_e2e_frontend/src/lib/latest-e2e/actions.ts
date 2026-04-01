import {
  deserializeAddress,
  deserializeDatum,
  mConStr0,
  mConStr1,
  mConStr2,
  mPubKeyAddress,
  type Asset,
  type UTxO,
} from "@meshsdk/core";
import { applyParamsToScript as applyCslParamsToScript } from "@meshsdk/core-csl";
import {
  BASKET_TOKEN_UNIT,
  CONFIG as ATRIUM_CONFIG,
  STAKE_POOL_UNIT,
} from "../../generated/atrium_mainnet/config";
import { encodeStakePoolDatum } from "../../generated/atrium_mainnet/datum";
import {
  basketTokensToLovelace,
  lovelaceToBasketTokens,
} from "../../generated/atrium_mainnet/math";
import {
  formatTimestampMs,
  toSafeIntegerNumber,
} from "../../generated/atrium_mainnet/safe";
import {
  fetchBasketUtxos,
  getLovelace,
  pickStakePoolUtxo,
} from "../../generated/atrium_mainnet/queries";
import {
  ATRIUM_POOL_STAKE_ASSET_NAME,
  BATCHING_HASH,
  BATCHING_REWARD_ADDRESS,
  BATCHING_SCRIPT_TX_HASH,
  BATCHING_SCRIPT_TX_IDX,
  GlobalSettingsAddr,
  MIN_ATRIUM_STAKE_POOL_LOVELACE,
  MIN_POOL_LOVELACE,
  MintingHash,
  MintingValidatorScript,
  OrderValidatorAddr,
  OrderValidatorHash,
  OrderValidatorScript,
  POOL_SCRIPT_TX_HASH,
  POOL_SCRIPT_TX_IDX,
  PoolValidatorAddr,
  PoolValidatorHash,
  PRECISION_FACTOR,
  REWARD_OUTPUT_LOVELACE,
  StakeRewardAddress,
  StakeValidatorScript,
  createBatchingWallet,
  fetchPlutusV3ScriptArtifactsByHash,
  createTestingProvider,
  createTxBuilder,
  pickCollateralUtxo,
} from "./contracts";
import {
  assetType,
  getBytesValue,
  getConstructorValue,
  formatExchangeRate,
  getFields,
  getIntValue,
  getQuantity,
  orderDatum,
  optInOrderType,
  poolDatum,
  pushAsset,
  redeemOrderType,
  scriptCredential,
  serializeTestingAddress,
  verificationKeySigner,
  type AddressValue,
  type DatumValue,
} from "./helpers";
import { resolveWalletAddress } from "./wallet";
import {
  deriveAtriumStakeArtifactsFromRewardsHash,
  deriveAtriumSwapArtifactsFromRewardsHash,
  deriveAtriumStakeArtifacts,
  deriveAtriumSwapArtifacts,
  deriveRewardsArtifacts,
  fetchAtriumPoolState,
  fetchGlobalSettingsState,
  fetchGlobalSettingsUtxo,
  validateStakeGlobalSettings,
  validateSwapGlobalSettings,
} from "./query";

type WalletLike = {
  getChangeAddress?: () => Promise<string>;
  getUnusedAddresses?: () => Promise<string[]>;
  getUsedAddresses?: () => Promise<string[]>;
  getUtxos(): Promise<UTxO[]>;
  signTx(tx: string, partialSign?: boolean): Promise<string>;
  submitTx(tx: string): Promise<string>;
};

type WalletContext = {
  walletAddress: string;
  walletVK: string;
  walletSK: string;
  walletUtxos: UTxO[];
  collateral: UTxO;
};

type BatchableOrder = {
  utxo: UTxO;
  orderData: DatumValue;
};

type RewardCandidate = {
  utxo: UTxO;
  diffusionAmount: bigint;
};

const toSafeBrowserDatumInt = (value: bigint, label: string) => {
  return toSafeIntegerNumber(
    value,
    `${label} for browser-side order datum encoding`,
  );
};

const resolveWalletContext = async (wallet: WalletLike): Promise<WalletContext> => {
  const walletAddress = await resolveWalletAddress(wallet);
  const walletUtxos = await wallet.getUtxos();
  const collateral = pickCollateralUtxo(walletUtxos);
  const { pubKeyHash, stakeCredentialHash } = deserializeAddress(walletAddress);

  return {
    walletAddress,
    walletVK: pubKeyHash,
    walletSK: stakeCredentialHash ?? "",
    walletUtxos,
    collateral,
  };
};

const submitWithWallet = async (wallet: WalletLike, unsignedTx: string) => {
  const signedTx = await wallet.signTx(unsignedTx, true);
  return wallet.submitTx(signedTx);
};

export const createOrderTx = async (
  wallet: WalletLike,
  kind: "deposit" | "redeem",
  amount: bigint,
) => {
  const provider = createTestingProvider();
  const txBuilder = createTxBuilder(provider);
  const { walletAddress, walletVK, walletSK, walletUtxos, collateral } =
    await resolveWalletContext(wallet);
  const gsUtxo = (await provider.fetchAddressUTxOs(GlobalSettingsAddr))[0];

  if (!gsUtxo) {
    throw new Error("Global settings UTxO not found.");
  }

  const datumAmount = toSafeBrowserDatumInt(amount, "Order amount");
  const orderData = orderDatum(
    kind === "deposit" ? optInOrderType(datumAmount) : redeemOrderType(datumAmount),
    mPubKeyAddress(walletVK, walletSK),
    verificationKeySigner(walletVK),
    ATRIUM_POOL_STAKE_ASSET_NAME,
  );

  let builder = txBuilder
    .readOnlyTxInReference(gsUtxo.input.txHash, gsUtxo.input.outputIndex)
    .mintPlutusScriptV3()
    .mint("1", OrderValidatorHash, "")
    .mintingScript(OrderValidatorScript)
    .mintRedeemerValue(mConStr0([]));

  if (kind === "deposit") {
    builder = builder
      .txOut(OrderValidatorAddr, [
        {
          unit: "lovelace",
          quantity: (amount + 2_000_000n).toString(),
        },
        { unit: OrderValidatorHash, quantity: "1" },
      ])
      .txOutInlineDatumValue(orderData);
  } else {
    builder = builder
      .txOut(OrderValidatorAddr, [
        { unit: "lovelace", quantity: "2500000" },
        { unit: OrderValidatorHash, quantity: "1" },
        {
          unit: MintingHash + ATRIUM_POOL_STAKE_ASSET_NAME,
          quantity: amount.toString(),
        },
      ])
      .txOutInlineDatumValue(orderData);
  }

  const unsignedTx = await builder
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .requiredSignerHash(walletVK)
    .changeAddress(walletAddress)
    .selectUtxosFrom(walletUtxos)
    .complete();

  return submitWithWallet(wallet, unsignedTx);
};

export const cancelOrderTx = async (
  wallet: WalletLike,
  txHash: string,
  outputIndex: number,
) => {
  const provider = createTestingProvider();
  const txBuilder = createTxBuilder(provider);
  const { walletAddress, walletVK, walletUtxos, collateral } =
    await resolveWalletContext(wallet);
  const orderUtxo = (await provider.fetchUTxOs(txHash, outputIndex))[0];

  if (!orderUtxo || !orderUtxo.output.plutusData) {
    throw new Error("Order UTxO not found.");
  }

  const orderData = deserializeDatum<DatumValue>(orderUtxo.output.plutusData);
  const orderFields = getFields(orderData, "order datum");
  const receiverAddress = serializeTestingAddress(orderFields[1] as AddressValue);

  if (receiverAddress !== walletAddress) {
    throw new Error("This wallet does not own the selected order.");
  }

  const receiverAmount = orderUtxo.output.amount.filter(
    (asset: Asset) => asset.unit !== OrderValidatorHash,
  );

  const unsignedTx = await txBuilder
    .spendingPlutusScriptV3()
    .txIn(
      orderUtxo.input.txHash,
      orderUtxo.input.outputIndex,
      orderUtxo.output.amount,
      orderUtxo.output.address,
    )
    .txInScript(OrderValidatorScript)
    .txInInlineDatumPresent()
    .txInRedeemerValue(mConStr0([]))
    .mintPlutusScriptV3()
    .mint("-1", OrderValidatorHash, "")
    .mintingScript(OrderValidatorScript)
    .mintRedeemerValue(mConStr1([]))
    .txOut(receiverAddress, receiverAmount)
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .setTotalCollateral("5000000")
    .changeAddress(walletAddress)
    .selectUtxosFrom(walletUtxos)
    .requiredSignerHash(walletVK)
    .complete();

  return submitWithWallet(wallet, unsignedTx);
};

export const batchOrdersTx = async () => {
  const provider = createTestingProvider();
  const batcher = createBatchingWallet(provider);
  const txBuilder = createTxBuilder(provider);
  const walletAddress = await batcher.getChangeAddress();
  const walletUtxos = await batcher.getUtxos();
  const collateral = pickCollateralUtxo(walletUtxos);
  const { pubKeyHash: walletVK } = deserializeAddress(walletAddress);
  const poolState = await fetchAtriumPoolState();
  const poolFields = getFields(poolState.datum, "pool datum");
  const poolAssetFields = getFields(poolFields[5], "pool asset");
  const poolAssetIsStable =
    getConstructorValue(poolAssetFields[0], "pool asset stable flag") === 1;
  const poolAssetPolicyId = getBytesValue(poolAssetFields[1], "pool asset policy");
  const poolAssetName = getBytesValue(poolAssetFields[2], "pool asset name");
  const poolAssetMultiplier = getIntValue(
    poolAssetFields[3],
    "pool asset multiplier",
  );
  const poolAssetUnit =
    poolAssetPolicyId === "" && poolAssetName === ""
      ? "lovelace"
      : poolAssetPolicyId + poolAssetName;
  const poolStakeUnit = MintingHash + ATRIUM_POOL_STAKE_ASSET_NAME;
  const exchangeRate = getIntValue(poolFields[3], "pool exchange rate");
  const totalRewardsAccrued = getIntValue(
    poolFields[4],
    "pool rewards accrued",
  );
  const isProcessingOpen =
    getConstructorValue(poolFields[7], "pool processing flag") === 1;
  const orderUtxos = await provider.fetchAddressUTxOs(OrderValidatorAddr);

  const matchingOrders = orderUtxos.flatMap((utxo: UTxO): BatchableOrder[] => {
    if (!utxo.output.plutusData) {
      return [];
    }

    const orderData = deserializeDatum<DatumValue>(utxo.output.plutusData);
    const orderFields = getFields(orderData, "order datum");
    if (
      getBytesValue(orderFields[3], "order pool stake asset") !==
      ATRIUM_POOL_STAKE_ASSET_NAME
    ) {
      return [];
    }

    return [{ utxo, orderData }];
  });

  const selectedOrders = matchingOrders
    .filter(({ utxo, orderData }: BatchableOrder) => {
      if (poolAssetUnit !== "lovelace") {
        return true;
      }

      const orderType = getFields(orderData, "order datum")[0];
      if (getConstructorValue(orderType, "order type") === 1) {
        return true;
      }

      const depositAmount = getIntValue(
        getFields(orderType, "order type")[0],
        "deposit amount",
      );
      const orderLovelace = getQuantity(utxo.output.amount, "lovelace");

      return orderLovelace - depositAmount >= 2_000_000n;
    })
    .slice(0, 10);

  if (selectedOrders.length === 0) {
    throw new Error("No batchable Atrium orders found.");
  }

  const poolAssetData = assetType(
    poolAssetPolicyId,
    poolAssetName,
    poolAssetMultiplier,
    poolAssetIsStable,
  );
  const batchingRedeemer = mConStr0([0, poolAssetData, ATRIUM_POOL_STAKE_ASSET_NAME]);

  let builder = txBuilder;
  let totalUnderlyingDelta = 0n;
  let totalStAssetsDelta = 0n;
  const userOutputs: Array<{ address: string; amount: Asset[] }> = [];

  for (const { utxo: orderUtxo, orderData } of selectedOrders) {
    const orderFields = getFields(orderData, "order datum");
    const orderType = orderFields[0];
    const receiverAddress = serializeTestingAddress(orderFields[1] as AddressValue);
    const orderLovelace = getQuantity(orderUtxo.output.amount, "lovelace");
    const orderStake = getQuantity(orderUtxo.output.amount, poolStakeUnit);

    builder = builder
      .spendingPlutusScriptV3()
      .txIn(
        orderUtxo.input.txHash,
        orderUtxo.input.outputIndex,
        orderUtxo.output.amount,
        orderUtxo.output.address,
      )
      .txInScript(OrderValidatorScript)
      .txInInlineDatumPresent()
      .txInRedeemerValue(mConStr1([]));

    const userOutputAmount: Asset[] = [
      { unit: "lovelace", quantity: orderLovelace.toString() },
    ];

    if (getConstructorValue(orderType, "order type") === 0) {
      const depositAmount = getIntValue(
        getFields(orderType, "order type")[0],
        "deposit amount",
      );
      const stAssetsToMint = (depositAmount * PRECISION_FACTOR) / exchangeRate;

      totalUnderlyingDelta += depositAmount;
      totalStAssetsDelta += stAssetsToMint;
      userOutputAmount[0] = {
        unit: "lovelace",
        quantity: (orderLovelace - depositAmount).toString(),
      };
      pushAsset(userOutputAmount, poolStakeUnit, stAssetsToMint);
    } else {
      const stAmount = getIntValue(
        getFields(orderType, "order type")[0],
        "redeem amount",
      );
      const underlyingToReturn = (stAmount * exchangeRate) / PRECISION_FACTOR;

      totalUnderlyingDelta -= underlyingToReturn;
      totalStAssetsDelta -= stAmount;
      userOutputAmount[0] = {
        unit: "lovelace",
        quantity: (orderLovelace + underlyingToReturn).toString(),
      };
      pushAsset(userOutputAmount, poolStakeUnit, orderStake - stAmount);
    }

    userOutputs.push({ address: receiverAddress, amount: userOutputAmount });
  }

  const updatedPoolDatum = poolDatum(
    scriptCredential(BATCHING_HASH),
    poolState.snapshot.totalStAssetsMinted + totalStAssetsDelta,
    poolState.snapshot.totalUnderlying + totalUnderlyingDelta,
    exchangeRate,
    totalRewardsAccrued,
    poolAssetData,
    ATRIUM_POOL_STAKE_ASSET_NAME,
    isProcessingOpen,
  );

  const poolOutputAmount: Asset[] = [];
  pushAsset(
    poolOutputAmount,
    "lovelace",
    poolAssetUnit === "lovelace"
      ? MIN_POOL_LOVELACE + poolState.snapshot.totalUnderlying + totalUnderlyingDelta
      : MIN_POOL_LOVELACE,
  );
  pushAsset(poolOutputAmount, poolState.snapshot.nftUnit, 1n);

  builder = builder
    .spendingPlutusScriptV3()
    .txIn(
      poolState.utxo.input.txHash,
      poolState.utxo.input.outputIndex,
      poolState.utxo.output.amount,
      poolState.utxo.output.address,
    )
    .spendingTxInReference(
      POOL_SCRIPT_TX_HASH,
      POOL_SCRIPT_TX_IDX,
      undefined,
      PoolValidatorHash,
    )
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue(mConStr0([]))
    .withdrawalPlutusScriptV3()
    .withdrawal(BATCHING_REWARD_ADDRESS, "0")
    .withdrawalTxInReference(
      BATCHING_SCRIPT_TX_HASH,
      BATCHING_SCRIPT_TX_IDX,
      undefined,
      BATCHING_HASH,
    )
    .withdrawalRedeemerValue(batchingRedeemer)
    .mintPlutusScriptV3()
    .mint(String(-selectedOrders.length), OrderValidatorHash, "")
    .mintingScript(OrderValidatorScript)
    .mintRedeemerValue(mConStr1([]));

  if (totalStAssetsDelta !== 0n) {
    builder = builder
      .mintPlutusScriptV3()
      .mint(totalStAssetsDelta.toString(), MintingHash, ATRIUM_POOL_STAKE_ASSET_NAME)
      .mintingScript(MintingValidatorScript)
      .mintRedeemerValue(mConStr0([]));
  }

  for (const userOutput of userOutputs) {
    builder = builder.txOut(userOutput.address, userOutput.amount);
  }

  const gsUtxo = await fetchGlobalSettingsUtxo();
  const unsignedTx = await builder
    .txOut(PoolValidatorAddr, poolOutputAmount)
    .txOutInlineDatumValue(updatedPoolDatum)
    .readOnlyTxInReference(gsUtxo.input.txHash, gsUtxo.input.outputIndex)
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .setTotalCollateral("10000000")
    .requiredSignerHash(walletVK)
    .changeAddress(walletAddress)
    .selectUtxosFrom(walletUtxos)
    .complete();

  const signedTx = await batcher.signTx(unsignedTx);
  return batcher.submitTx(signedTx);
};

export const stakePoolToAtriumTx = async (wallet: WalletLike) => {
  const provider = createTestingProvider();
  const txBuilder = createTxBuilder(provider);
  const { walletAddress, walletVK, walletUtxos, collateral } =
    await resolveWalletContext(wallet);
  const gsState = await fetchGlobalSettingsState();
  const gsUtxo = gsState.utxo;
  const poolState = await fetchAtriumPoolState();
  const poolFields = getFields(poolState.datum, "pool datum");
  const poolAssetFields = getFields(poolFields[5], "pool asset");
  const poolAssetIsStable =
    getConstructorValue(poolAssetFields[0], "pool asset stable flag") === 1;
  const poolAssetPolicyId = getBytesValue(poolAssetFields[1], "pool asset policy");
  const poolAssetName = getBytesValue(poolAssetFields[2], "pool asset name");
  const poolAssetMultiplier = getIntValue(
    poolAssetFields[3],
    "pool asset multiplier",
  );
  const poolStakeAssetName = getBytesValue(
    poolFields[6],
    "pool stake asset name",
  );

  if (poolAssetPolicyId !== "" || poolAssetName !== "") {
    throw new Error("The latest e2e stake-to-atrium flow currently supports the ADA pool only.");
  }

  const poolUnderlying = getQuantity(poolState.utxo.output.amount, "lovelace") - MIN_POOL_LOVELACE;
  if (poolUnderlying <= 0n) {
    throw new Error("The pool has no ADA available to stake.");
  }

  const {
    atriumStakeValidatorScript: derivedAtriumStakeValidatorScript,
    atriumStakeValidatorHash: derivedAtriumStakeValidatorHash,
    atriumStakeRewardAddress: derivedAtriumStakeRewardAddress,
  } = deriveAtriumStakeArtifactsFromRewardsHash(gsState.rewardsValidatorHash);

  const stakeValidation = validateStakeGlobalSettings(
    gsUtxo.output.plutusData!,
    derivedAtriumStakeValidatorHash,
  );
  const atriumStakeArtifacts = stakeValidation.requiresOnChainVerifierScript
    ? await fetchPlutusV3ScriptArtifactsByHash(
        stakeValidation.storedAtriumStakeValidatorHash,
      )
    : {
        rewardAddress: derivedAtriumStakeRewardAddress,
        script: derivedAtriumStakeValidatorScript,
      };

  const { basketState, stakePools } = await fetchBasketUtxos(provider);
  const atriumStakePool = pickStakePoolUtxo(stakePools);
  const state = basketState.datum;
  if (state.lock.type === "Locked") {
    throw new Error(
      `Atrium basket is locked at ${formatTimestampMs(
        state.lock.lockedAt,
        "an unknown time",
      )}.`,
    );
  }

  const diffusionToMint = lovelaceToBasketTokens(state.exRate, poolUnderlying);
  if (diffusionToMint <= 0n) {
    throw new Error(
      `At the current Atrium rate (${formatExchangeRate(state.exRate)}), the pool stakes 0 Diffusion.`,
    );
  }

  const updatedAtriumDatum = encodeStakePoolDatum({
    poolPkh: atriumStakePool.datum.poolPkh,
    basketTokenCounter:
      atriumStakePool.datum.basketTokenCounter + diffusionToMint,
  });
  const updatedAtriumLovelace = getLovelace(atriumStakePool.utxo) + poolUnderlying;
  const basketTokenUnit = ATRIUM_CONFIG.basketTokenCS + ATRIUM_CONFIG.basketTokenTN;
  const poolAssetData = assetType(
    poolAssetPolicyId,
    poolAssetName,
    poolAssetMultiplier,
    poolAssetIsStable,
  );

  const unsignedTx = await txBuilder
    .readOnlyTxInReference(gsUtxo.input.txHash, gsUtxo.input.outputIndex)
    .spendingPlutusScriptV3()
    .txIn(
      poolState.utxo.input.txHash,
      poolState.utxo.input.outputIndex,
      poolState.utxo.output.amount,
      poolState.utxo.output.address,
    )
    .spendingTxInReference(
      POOL_SCRIPT_TX_HASH,
      POOL_SCRIPT_TX_IDX,
      undefined,
      PoolValidatorHash,
    )
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue(mConStr2([]))
    .withdrawalPlutusScriptV3()
    .withdrawal(StakeRewardAddress, "0")
    .withdrawalScript(StakeValidatorScript)
    .withdrawalRedeemerValue(mConStr0([poolAssetData, 0]))
    .withdrawalPlutusScriptV3()
    .withdrawal(atriumStakeArtifacts.rewardAddress, "0")
    .withdrawalScript(atriumStakeArtifacts.script)
    .withdrawalRedeemerValue(mConStr0([poolAssetData, poolStakeAssetName]))
    .spendingPlutusScriptV2()
    .txIn(
      atriumStakePool.utxo.input.txHash,
      atriumStakePool.utxo.input.outputIndex,
      atriumStakePool.utxo.output.amount,
      atriumStakePool.utxo.output.address,
    )
    .txInInlineDatumPresent()
    .txInRedeemerValue({ constructor: 0, fields: [] }, "JSON")
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
    .mintRedeemerValue({ constructor: 0, fields: [] }, "JSON")
    .txOut(PoolValidatorAddr, [
      { unit: "lovelace", quantity: MIN_POOL_LOVELACE.toString() },
      { unit: poolState.snapshot.nftUnit, quantity: "1" },
    ])
    .txOutInlineDatumValue(poolState.utxo.output.plutusData!, "CBOR")
    .txOut(atriumStakePool.utxo.output.address, [
      { unit: "lovelace", quantity: updatedAtriumLovelace.toString() },
      { unit: STAKE_POOL_UNIT, quantity: "1" },
    ])
    .txOutInlineDatumValue(updatedAtriumDatum, "JSON")
    .txOut(gsState.rewardsValidatorAddr, [
      { unit: "lovelace", quantity: REWARD_OUTPUT_LOVELACE.toString() },
      { unit: basketTokenUnit, quantity: diffusionToMint.toString() },
    ])
    .metadataValue(674, { msg: ["Stake Lava Atrium pool into Atrium"] })
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .requiredSignerHash(walletVK)
    .changeAddress(walletAddress)
    .selectUtxosFrom(walletUtxos)
    .complete();

  return submitWithWallet(wallet, unsignedTx);
};

export const withdrawPoolFromAtriumTx = async (wallet: WalletLike) => {
  const provider = createTestingProvider();
  const txBuilder = createTxBuilder(provider);
  const { walletAddress, walletUtxos, collateral } =
    await resolveWalletContext(wallet);
  const gsState = await fetchGlobalSettingsState();
  const gsUtxo = gsState.utxo;
  const poolState = await fetchAtriumPoolState();
  const rewardsArtifacts = deriveRewardsArtifacts(poolState.snapshot.nftName);
  const {
    atriumSwapValidatorScript,
    atriumSwapValidatorHash,
    atriumSwapRewardAddress,
  } = deriveAtriumSwapArtifactsFromRewardsHash(gsState.rewardsValidatorHash);

  validateSwapGlobalSettings(
    gsUtxo.output.plutusData!,
    atriumSwapValidatorHash,
  );

  if (rewardsArtifacts.rewardsValidatorHash !== gsState.rewardsValidatorHash) {
    throw new Error(
      `The local rewards validator script does not match global settings. Stored=${gsState.rewardsValidatorHash}, local=${rewardsArtifacts.rewardsValidatorHash}. Restart lava_e2e_frontend so it reloads the latest synced contracts.`,
    );
  }

  const rewardUtxos = await provider.fetchAddressUTxOs(
    gsState.rewardsValidatorAddr,
  );
  const rewardCandidates = rewardUtxos
    .flatMap((utxo: UTxO): RewardCandidate[] => {
      const diffusionAmount = getQuantity(utxo.output.amount, BASKET_TOKEN_UNIT);
      if (diffusionAmount <= 0n) {
        return [];
      }

      const hasUnexpectedAssets = utxo.output.amount.some(
        (asset: Asset) =>
          BigInt(asset.quantity) > 0n &&
          asset.unit !== "lovelace" &&
          asset.unit !== BASKET_TOKEN_UNIT,
      );
      if (hasUnexpectedAssets) {
        return [];
      }

      return [{ utxo, diffusionAmount }];
    })
    .sort((left: RewardCandidate, right: RewardCandidate) =>
      left.diffusionAmount === right.diffusionAmount
        ? 0
        : left.diffusionAmount > right.diffusionAmount
          ? -1
          : 1,
    );

  const selectedReward = rewardCandidates[0];
  if (!selectedReward) {
    throw new Error("No pure Diffusion rewards UTxO is available to withdraw.");
  }

  const { basketState, stakePools } = await fetchBasketUtxos(provider);
  const atriumStakePool = pickStakePoolUtxo(stakePools);
  const state = basketState.datum;

  if (state.lock.type === "Locked") {
    throw new Error(
      `Atrium basket is locked at ${formatTimestampMs(
        state.lock.lockedAt,
        "an unknown time",
      )}.`,
    );
  }
  if (state.pledgeLock.type === "Locked") {
    throw new Error(
      `Atrium basket pledge lock is active at ${formatTimestampMs(
        state.pledgeLock.lockedAt,
        "an unknown time",
      )}.`,
    );
  }

  const lovelaceToRelease = basketTokensToLovelace(
    state.exRate,
    selectedReward.diffusionAmount,
  );
  if (lovelaceToRelease <= 0n) {
    throw new Error("The selected rewards UTxO is too small to release ADA.");
  }

  const currentAtriumLovelace = getLovelace(atriumStakePool.utxo);
  const updatedAtriumLovelace = currentAtriumLovelace - lovelaceToRelease;
  if (updatedAtriumLovelace < MIN_ATRIUM_STAKE_POOL_LOVELACE) {
    throw new Error("Withdrawing would drop the Atrium stake-pool UTxO below minimum lovelace.");
  }

  if (atriumStakePool.datum.basketTokenCounter < selectedReward.diffusionAmount) {
    throw new Error("Atrium basket token counter is lower than the selected Diffusion amount.");
  }

  const updatedAtriumDatum = encodeStakePoolDatum({
    poolPkh: atriumStakePool.datum.poolPkh,
    basketTokenCounter:
      atriumStakePool.datum.basketTokenCounter - selectedReward.diffusionAmount,
  });

  const unsignedTx = await txBuilder
    .readOnlyTxInReference(gsUtxo.input.txHash, gsUtxo.input.outputIndex)
    .spendingPlutusScriptV3()
    .txIn(
      selectedReward.utxo.input.txHash,
      selectedReward.utxo.input.outputIndex,
      selectedReward.utxo.output.amount,
      selectedReward.utxo.output.address,
    )
    .txInScript(rewardsArtifacts.rewardsValidatorScript)
    .txInInlineDatumPresent()
    .txInRedeemerValue(mConStr1([]))
    .withdrawalPlutusScriptV3()
    .withdrawal(atriumSwapRewardAddress, "0")
    .withdrawalScript(atriumSwapValidatorScript)
    .withdrawalRedeemerValue(mConStr0([]))
    .spendingPlutusScriptV2()
    .txIn(
      atriumStakePool.utxo.input.txHash,
      atriumStakePool.utxo.input.outputIndex,
      atriumStakePool.utxo.output.amount,
      atriumStakePool.utxo.output.address,
    )
    .txInInlineDatumPresent()
    .txInRedeemerValue({ constructor: 1, fields: [] }, "JSON")
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
      (-selectedReward.diffusionAmount).toString(),
      ATRIUM_CONFIG.basketTokenCS,
      ATRIUM_CONFIG.basketTokenTN,
    )
    .mintingScript(applyCslParamsToScript(ATRIUM_CONFIG.basketTokenMPCbor, []))
    .mintRedeemerValue({ constructor: 0, fields: [] }, "JSON")
    .txOut(atriumStakePool.utxo.output.address, [
      { unit: "lovelace", quantity: updatedAtriumLovelace.toString() },
      { unit: STAKE_POOL_UNIT, quantity: "1" },
    ])
    .txOutInlineDatumValue(updatedAtriumDatum, "JSON")
    .txOut(gsState.rewardsValidatorAddr, [
      { unit: "lovelace", quantity: lovelaceToRelease.toString() },
    ])
    .metadataValue(674, { msg: ["Withdraw Lava Atrium rewards from Atrium"] })
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .changeAddress(walletAddress)
    .selectUtxosFrom(walletUtxos)
    .complete();

  return submitWithWallet(wallet, unsignedTx);
};
