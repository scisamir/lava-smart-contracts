import {
  applyParamsToScript,
  builtinByteString,
  deserializeDatum,
  mConStr0,
  mConStr1,
  resolveScriptHash,
  scriptAddress,
  serializePlutusScript,
  serializeRewardAddress,
  type Asset,
} from "@meshsdk/core";
import { applyParamsToScript as applyCslParamsToScript } from "@meshsdk/core-csl";
import {
  BASKET_TOKEN_UNIT,
  CONFIG as ATRIUM_CONFIG,
  STAKE_POOL_UNIT,
} from "../atrium_mainnet/src/config.js";
import { encodeStakePoolDatum } from "../atrium_mainnet/src/datum.js";
import {
  basketTokensToLovelace,
  formatExRate,
  formatLovelace,
} from "../atrium_mainnet/src/math.js";
import {
  fetchBasketUtxos,
  getLovelace,
  pickStakePoolUtxo,
} from "../atrium_mainnet/src/queries.js";
import {
  GlobalSettingsAddr,
  GlobalSettingsHash,
} from "../global_settings/validator.js";
import {
  ATRIUM_POOL_STAKE_ASSET_NAME,
  blueprint,
  blockchainProvider,
  NETWORK_ID,
  txBuilder,
  wallet1,
  wallet1Address,
  wallet1Utxos,
  requireWallet1Collateral,
} from "../setup.js";
import { PoolDatumType } from "../types.js";
import { PoolValidatorAddr, PoolValidatorHash } from "./validator.js";

const REWARDS_SWAP_REDEEMER = mConStr1([]);
const ATRIUM_SWAP_REDEEMER = mConStr0([]);
const ATRIUM_WITHDRAW_REDEEMER = { constructor: 1, fields: [] };
const MIN_ATRIUM_STAKE_POOL_LOVELACE = 2_000_000n;

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

const getBytesList = (value: unknown, label: string): string[] => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("list" in value) ||
    !Array.isArray((value as { list: unknown[] }).list)
  ) {
    throw new Error(`Expected list for ${label}`);
  }

  return (value as { list: unknown[] }).list.map((item, index) =>
    getBytes(item, `${label}[${index}]`),
  );
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

  const atriumSwapValidatorScript = applyParamsToScript(
    requireValidator("swap_validators/atrium_swap.atrium_swap.withdraw")
      .compiledCode,
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
    rewardsValidatorScript,
    rewardsValidatorHash,
    rewardsValidatorAddr,
    atriumSwapValidatorScript,
    atriumSwapValidatorHash,
    atriumSwapRewardAddress,
  };
};

const validateGlobalSettings = (
  gsPlutusData: string,
  expectedRewardsValidatorHash: string,
  expectedAtriumSwapValidatorHash: string,
) => {
  const gsDatum = deserializeDatum<any>(gsPlutusData);
  const storedRewardsValidatorHash = getBytes(
    gsDatum.fields[8],
    "global settings rewards_validator_hash",
  );
  const storedAuthorizedSwapScripts = getBytesList(
    gsDatum.fields[6],
    "global settings authorized_swap_scripts",
  );

  if (storedRewardsValidatorHash !== expectedRewardsValidatorHash) {
    throw new Error(
      "Global settings rewards_validator_hash does not match the live Atrium pool. Re-run e2e/global_settings/update_gs.ts with the current Atrium pool seed.",
    );
  }

  if (!storedAuthorizedSwapScripts.includes(expectedAtriumSwapValidatorHash)) {
    throw new Error(
      "Global settings authorized_swap_scripts does not include the live Atrium swap validator. Re-run e2e/global_settings/update_gs.ts with the current Atrium pool seed.",
    );
  }
};

const hasUnexpectedRewardAsset = (utxo: {
  output: { amount: Asset[] };
}): boolean =>
  utxo.output.amount.some(
    (asset) =>
      BigInt(asset.quantity) > 0n &&
      asset.unit !== "lovelace" &&
      asset.unit !== BASKET_TOKEN_UNIT,
  );

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

    return [{ utxo }];
  });

  if (matchingPools.length === 0) {
    throw new Error("No Atrium Lava pool UTxO found");
  }

  const [{ utxo: poolUtxo }] = matchingPools;
  const poolNft = poolUtxo.output.amount.find(
    (asset) =>
      asset.unit.startsWith(PoolValidatorHash) && asset.unit !== "lovelace",
  );
  if (!poolNft) {
    throw new Error("Atrium Lava pool NFT not found");
  }

  const actualPoolNftName = poolNft.unit.slice(PoolValidatorHash.length);
  const {
    rewardsValidatorScript,
    rewardsValidatorHash,
    rewardsValidatorAddr,
    atriumSwapValidatorScript,
    atriumSwapValidatorHash,
    atriumSwapRewardAddress,
  } = deriveAtriumScripts(actualPoolNftName);

  validateGlobalSettings(
    gsUtxo.output.plutusData,
    rewardsValidatorHash,
    atriumSwapValidatorHash,
  );

  const rewardUtxos =
    await blockchainProvider.fetchAddressUTxOs(rewardsValidatorAddr);
  const pureRewardCandidates = rewardUtxos
    .flatMap((utxo) => {
      const diffusionAmount = getQuantity(utxo.output.amount, BASKET_TOKEN_UNIT);
      if (diffusionAmount <= 0n) {
        return [];
      }

      if (hasUnexpectedRewardAsset(utxo)) {
        return [];
      }

      return [
        {
          utxo,
          diffusionAmount,
          rewardLovelace: getQuantity(utxo.output.amount, "lovelace"),
        },
      ];
    })
    .sort((left, right) =>
      left.diffusionAmount === right.diffusionAmount
        ? 0
        : left.diffusionAmount > right.diffusionAmount
          ? -1
          : 1,
    );

  if (pureRewardCandidates.length === 0) {
    const impureRewardUtxo = rewardUtxos.find(
      (utxo) => getQuantity(utxo.output.amount, BASKET_TOKEN_UNIT) > 0n,
    );

    if (impureRewardUtxo) {
      throw new Error(
        "Atrium rewards UTxO found, but it contains assets other than lovelace and Diffusion. Clean that rewards UTxO up before running withdraw_from_atrium.ts.",
      );
    }

    throw new Error("No Atrium rewards UTxO with Diffusion found");
  }

  const [{ utxo: rewardUtxo, diffusionAmount, rewardLovelace }] =
    pureRewardCandidates;

  const { basketState, stakePools } =
    await fetchBasketUtxos(blockchainProvider);
  const atriumStakePool = pickStakePoolUtxo(stakePools);
  const state = basketState.datum;

  if (state.lock.type === "Locked") {
    throw new Error(
      `Atrium basket is currently locked at ${new Date(Number(state.lock.lockedAt)).toISOString()}.`,
    );
  }

  if (state.pledgeLock.type === "Locked") {
    throw new Error(
      `Atrium basket pledge lock is active at ${new Date(Number(state.pledgeLock.lockedAt)).toISOString()}.`,
    );
  }

  const currentAtriumLovelace = getLovelace(atriumStakePool.utxo);
  const lovelaceToRelease = basketTokensToLovelace(
    state.exRate,
    diffusionAmount,
  );

  if (lovelaceToRelease <= 0n) {
    throw new Error(
      `Selected rewards UTxO is too small. Burning ${diffusionAmount} Diffusion releases 0 lovelace at the current rate (${formatExRate(state.exRate)}).`,
    );
  }

  if (atriumStakePool.datum.basketTokenCounter < diffusionAmount) {
    throw new Error(
      "Atrium stake-pool datum basket token counter is lower than the Diffusion amount being burned.",
    );
  }

  const updatedAtriumLovelace = currentAtriumLovelace - lovelaceToRelease;
  if (updatedAtriumLovelace < MIN_ATRIUM_STAKE_POOL_LOVELACE) {
    throw new Error(
      `Atrium stake-pool UTxO would drop below ${formatLovelace(MIN_ATRIUM_STAKE_POOL_LOVELACE)}.`,
    );
  }

  const updatedAtriumDatum = encodeStakePoolDatum({
    poolPkh: atriumStakePool.datum.poolPkh,
    basketTokenCounter:
      atriumStakePool.datum.basketTokenCounter - diffusionAmount,
  });

  console.log("Atrium pool NFT:", actualPoolNftName);
  console.log("Atrium pool NFT source: live");
  console.log("Rewards validator hash:", rewardsValidatorHash);
  console.log("Atrium swap validator hash:", atriumSwapValidatorHash);
  console.log("Selected rewards UTxO:", `${rewardUtxo.input.txHash}#${rewardUtxo.input.outputIndex}`);
  console.log("Rewards UTxO lovelace wrapper:", formatLovelace(rewardLovelace));
  console.log("Current Atrium exchange rate:", formatExRate(state.exRate));
  console.log("Diffusion to burn:", diffusionAmount.toString());
  console.log("ADA to release:", formatLovelace(lovelaceToRelease));

  const unsignedTx = await txBuilder
    .readOnlyTxInReference(gsUtxo.input.txHash, gsUtxo.input.outputIndex)
    .spendingPlutusScriptV3()
    .txIn(
      rewardUtxo.input.txHash,
      rewardUtxo.input.outputIndex,
      rewardUtxo.output.amount,
      rewardUtxo.output.address,
    )
    .txInScript(rewardsValidatorScript)
    .txInInlineDatumPresent()
    .txInRedeemerValue(REWARDS_SWAP_REDEEMER)
    .withdrawalPlutusScriptV3()
    .withdrawal(atriumSwapRewardAddress, "0")
    .withdrawalScript(atriumSwapValidatorScript)
    .withdrawalRedeemerValue(ATRIUM_SWAP_REDEEMER)
    .spendingPlutusScriptV2()
    .txIn(
      atriumStakePool.utxo.input.txHash,
      atriumStakePool.utxo.input.outputIndex,
      atriumStakePool.utxo.output.amount,
      atriumStakePool.utxo.output.address,
    )
    .txInInlineDatumPresent()
    .txInRedeemerValue(ATRIUM_WITHDRAW_REDEEMER, "JSON")
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
      (-diffusionAmount).toString(),
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
    .txOut(rewardsValidatorAddr, [
      { unit: "lovelace", quantity: lovelaceToRelease.toString() },
    ])
    .metadataValue(674, { msg: ["Withdraw Lava Atrium rewards from Atrium"] })
    .txInCollateral(
      wallet1Collateral.input.txHash,
      wallet1Collateral.input.outputIndex,
    )
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .complete();

  const signedTx = await wallet1.signTx(unsignedTx);
  const txHash = await wallet1.submitTx(signedTx);

  console.log("Withdraw from atrium tx hash:", txHash);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
