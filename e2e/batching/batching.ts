import {
  deserializeDatum,
  mConStr0,
  mConStr1,
  serializeAddressObj,
  type Asset,
} from "@meshsdk/core";
import {
  batchingScriptTxHash,
  batchingScriptTxIdx,
  blockchainProvider,
  MinPoolLovelace,
  PrecisionFactor,
  poolScriptTxHash,
  poolScriptTxIdx,
  poolStakeAssetName,
  tPulsePoolStakeAssetName,
  tStrikePoolStakeAssetName,
  txBuilder,
  wallet1,
  wallet1Address,
  wallet1Utxos,
  wallet1VK,
  requireWallet1Collateral,
} from "../setup.js";
import {
  assetType,
  poolDatum as buildPoolDatum,
  scriptCredential,
} from "../data.js";
import {
  OrderValidatorAddr,
  OrderValidatorHash,
  OrderValidatorScript,
} from "../order/validator.js";
import { PoolValidatorAddr, PoolValidatorHash } from "../pool/validator.js";
import {
  BatchingHash,
  BatchingRewardAddress,
} from "./validator.js";
import { GlobalSettingsAddr } from "../global_settings/validator.js";
import { OrderDatumType, PoolDatumType } from "../types.js";
import { MintingHash, MintingValidatorScript } from "../mint/validator.js";

const poolSAN = poolStakeAssetName;
// const poolSAN = tStrikePoolStakeAssetName;
// const poolSAN = tPulsePoolStakeAssetName;

const noOfUtxosToBatch = 10;
const precisionFactor = BigInt(PrecisionFactor);
const wallet1Collateral = requireWallet1Collateral();

const getQuantity = (assets: Asset[], unit: string) =>
  BigInt(assets.find((asset) => asset.unit === unit)?.quantity ?? "0");

const pushAsset = (assets: Asset[], unit: string, quantity: bigint) => {
  if (quantity > 0n) {
    assets.push({ unit, quantity: quantity.toString() });
  }
};

const orderUtxos = await blockchainProvider.fetchAddressUTxOs(OrderValidatorAddr);
const poolUtxos = await blockchainProvider.fetchAddressUTxOs(PoolValidatorAddr);

const poolUtxo = poolUtxos.find((utxo) => {
  const poolPlutusData = utxo.output.plutusData;
  if (!poolPlutusData) {
    return false;
  }

  const poolData = deserializeDatum<PoolDatumType>(poolPlutusData);
  return poolData.fields[6].bytes === poolSAN;
});

if (!poolUtxo) {
  throw new Error("Pool UTxO not found");
}

const poolPlutusData = poolUtxo.output.plutusData;
if (!poolPlutusData) {
  throw new Error("Pool datum not found");
}

const poolData = deserializeDatum<PoolDatumType>(poolPlutusData);
const poolAssetField = poolData.fields[5];
const poolAssetIsStable = Number(poolAssetField.fields[0].constructor) === 1;
const poolAssetPolicyId = poolAssetField.fields[1].bytes;
const poolAssetName = poolAssetField.fields[2].bytes;
const poolAssetMultiplier = BigInt(poolAssetField.fields[3].int);
const poolAssetUnit =
  poolAssetPolicyId === "" && poolAssetName === ""
    ? "lovelace"
    : poolAssetPolicyId + poolAssetName;
const poolStakeUnit = MintingHash + poolSAN;
const exchangeRate = BigInt(poolData.fields[3].int);
const totalRewardsAccrued = BigInt(poolData.fields[4].int);
const isProcessingOpen = Number(poolData.fields[7].constructor) === 1;
const currentTotalStAssetsMinted = BigInt(poolData.fields[1].int);
const currentTotalUnderlying = BigInt(poolData.fields[2].int);

const poolNft = poolUtxo.output.amount.find(
  (asset) => asset.unit.startsWith(PoolValidatorHash) && asset.unit !== poolAssetUnit,
);

if (!poolNft) {
  throw new Error("Pool NFT not found");
}

const selectedOrderUtxos = orderUtxos
  .filter((utxo) => {
    const orderPlutusData = utxo.output.plutusData;
    if (!orderPlutusData) {
      return false;
    }

    const orderData = deserializeDatum<OrderDatumType>(orderPlutusData);
    return orderData.fields[3].bytes === poolSAN;
  })
  .slice(0, noOfUtxosToBatch);

if (selectedOrderUtxos.length === 0) {
  throw new Error("No order UTxOs to batch");
}

const poolAssetData = assetType(
  poolAssetPolicyId,
  poolAssetName,
  poolAssetMultiplier,
  poolAssetIsStable,
);

const batchingRedeemer = mConStr0([0, poolAssetData, poolSAN]);

let builder = txBuilder;
let totalUnderlyingDelta = 0n;
let totalStAssetsDelta = 0n;
const userOutputs: Array<{ address: string; amount: Asset[] }> = [];

for (const orderUtxo of selectedOrderUtxos) {
  const orderPlutusData = orderUtxo.output.plutusData;
  if (!orderPlutusData) {
    throw new Error("Order datum not found");
  }

  const orderData = deserializeDatum<OrderDatumType>(orderPlutusData);
  const orderType = orderData.fields[0];
  const receiverAddress = serializeAddressObj(orderData.fields[1]);
  const orderLovelace = getQuantity(orderUtxo.output.amount, "lovelace");
  const orderUnderlying = getQuantity(orderUtxo.output.amount, poolAssetUnit);
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

  const userOutputAmount: Asset[] = [];

  if (poolAssetUnit === "lovelace") {
    pushAsset(userOutputAmount, "lovelace", orderLovelace);
  } else {
    pushAsset(userOutputAmount, "lovelace", orderLovelace);
  }

  if (Number(orderType.constructor) === 0) {
    const depositAmount = BigInt(orderType.fields[0].int);
    const stAssetsToMint = (depositAmount * precisionFactor) / exchangeRate;

    totalUnderlyingDelta += depositAmount;
    totalStAssetsDelta += stAssetsToMint;

    if (poolAssetUnit === "lovelace") {
      userOutputAmount[0] = {
        unit: "lovelace",
        quantity: (orderLovelace - depositAmount).toString(),
      };
    } else {
      pushAsset(userOutputAmount, poolAssetUnit, orderUnderlying - depositAmount);
    }

    pushAsset(userOutputAmount, poolStakeUnit, stAssetsToMint);
  } else {
    const stAmount = BigInt(orderType.fields[0].int);
    const underlyingToReturn = (stAmount * exchangeRate) / precisionFactor;

    totalUnderlyingDelta -= underlyingToReturn;
    totalStAssetsDelta -= stAmount;

    if (poolAssetUnit === "lovelace") {
      userOutputAmount[0] = {
        unit: "lovelace",
        quantity: (orderLovelace + underlyingToReturn).toString(),
      };
    } else {
      pushAsset(userOutputAmount, poolAssetUnit, underlyingToReturn);
    }

    pushAsset(userOutputAmount, poolStakeUnit, orderStake - stAmount);
  }

  userOutputs.push({ address: receiverAddress, amount: userOutputAmount });
}

const updatedTotalStAssetsMinted =
  currentTotalStAssetsMinted + totalStAssetsDelta;
const updatedTotalUnderlying = currentTotalUnderlying + totalUnderlyingDelta;

const updatedPoolDatum = buildPoolDatum(
  scriptCredential(BatchingHash),
  updatedTotalStAssetsMinted,
  updatedTotalUnderlying,
  exchangeRate,
  totalRewardsAccrued,
  poolAssetData,
  poolSAN,
  isProcessingOpen,
);

const poolOutputAmount: Asset[] = [];
pushAsset(
  poolOutputAmount,
  "lovelace",
  poolAssetUnit === "lovelace"
    ? BigInt(MinPoolLovelace) + updatedTotalUnderlying
    : BigInt(MinPoolLovelace),
);
pushAsset(poolOutputAmount, poolNft.unit, 1n);
if (poolAssetUnit !== "lovelace") {
  pushAsset(poolOutputAmount, poolAssetUnit, updatedTotalUnderlying);
}

builder = builder
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
  .spendingReferenceTxInRedeemerValue(mConStr0([]))
  .withdrawalPlutusScriptV3()
  .withdrawal(BatchingRewardAddress, "0")
  .withdrawalTxInReference(
    batchingScriptTxHash,
    batchingScriptTxIdx,
    undefined,
    BatchingHash,
  )
  .withdrawalRedeemerValue(batchingRedeemer)
  .mintPlutusScriptV3()
  .mint(String(-selectedOrderUtxos.length), OrderValidatorHash, "")
  .mintingScript(OrderValidatorScript)
  .mintRedeemerValue(mConStr1([]));

if (totalStAssetsDelta !== 0n) {
  builder = builder
    .mintPlutusScriptV3()
    .mint(totalStAssetsDelta.toString(), MintingHash, poolSAN)
    .mintingScript(MintingValidatorScript)
    .mintRedeemerValue(mConStr0([]));
}

for (const userOutput of userOutputs) {
  builder = builder.txOut(userOutput.address, userOutput.amount);
}

const gsUtxo = (await blockchainProvider.fetchAddressUTxOs(GlobalSettingsAddr))[0];

const unsignedTx = await builder
  .txOut(PoolValidatorAddr, poolOutputAmount)
  .txOutInlineDatumValue(updatedPoolDatum)
  .readOnlyTxInReference(gsUtxo.input.txHash, gsUtxo.input.outputIndex)
  .txInCollateral(
    wallet1Collateral.input.txHash,
    wallet1Collateral.input.outputIndex,
  )
  .setTotalCollateral("10000000")
  .requiredSignerHash(wallet1VK)
  .changeAddress(wallet1Address)
  .selectUtxosFrom(wallet1Utxos)
  .complete();

const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);

console.log("batched orders:", selectedOrderUtxos.length);
console.log("pool stake asset name:", poolSAN);
console.log("total st delta:", totalStAssetsDelta.toString());
console.log("total underlying delta:", totalUnderlyingDelta.toString());
console.log("batching tx hash:", txHash);
