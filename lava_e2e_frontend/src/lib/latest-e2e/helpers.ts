import {
  mConStr0,
  mConStr1,
  serializeAddressObj,
  type Asset,
  type Data,
} from "@meshsdk/core";
import {
  formatTimestampMs,
  toSafeIntegerNumber,
} from "../../generated/atrium_mainnet/safe";
import { NETWORK_ID } from "./contracts";

export type DatumValue = {
  constructor?: number | string | bigint;
  fields?: DatumValue[];
  bytes?: string;
  int?: number | string | bigint;
  list?: DatumValue[];
};

export type AddressValue = Parameters<typeof serializeAddressObj>[0];

export const falseData = (): Data => mConStr0([]);
export const trueData = (): Data => mConStr1([]);
export const verificationKeySigner = (verificationKeyHash: string): Data =>
  mConStr0([verificationKeyHash]);
export const scriptCredential = (scriptHash: string): Data => mConStr1([scriptHash]);
export const assetType = (
  policyId: string,
  assetName: string,
  multiplier: number | bigint,
  isStable = false,
): Data =>
  mConStr0([
    isStable ? trueData() : falseData(),
    policyId,
    assetName,
    multiplier,
  ]);
export const optInOrderType = (depositAmount: number | bigint): Data =>
  mConStr0([depositAmount]);
export const redeemOrderType = (stAmount: number | bigint): Data =>
  mConStr1([stAmount]);
export const orderDatum = (
  orderType: Data,
  receiverAddress: Data,
  canceller: Data,
  poolStakeAssetName: string,
): Data => mConStr0([orderType, receiverAddress, canceller, poolStakeAssetName]);
export const poolDatum = (
  poolBatchingCredential: Data,
  totalStAssetsMinted: bigint,
  totalUnderlying: bigint,
  exchangeRate: bigint,
  totalRewardsAccrued: bigint,
  poolAsset: Data,
  poolStakeAssetName: string,
  isProcessingOpen: boolean,
): Data =>
  mConStr0([
    poolBatchingCredential,
    totalStAssetsMinted,
    totalUnderlying,
    exchangeRate,
    totalRewardsAccrued,
    poolAsset,
    poolStakeAssetName,
    isProcessingOpen ? trueData() : falseData(),
  ]);

export const getFields = (value: DatumValue, label: string): DatumValue[] => {
  if (!Array.isArray(value.fields)) {
    throw new Error(`Expected fields for ${label}`);
  }

  return value.fields;
};

export const getConstructorValue = (value: DatumValue, label: string) => {
  if (!Object.prototype.hasOwnProperty.call(value, "constructor")) {
    throw new Error(`Expected constructor for ${label}`);
  }

  const constructorValue = value.constructor;
  if (constructorValue === undefined) {
    throw new Error(`Expected constructor for ${label}`);
  }

  return toSafeIntegerNumber(constructorValue, `${label} constructor`);
};

export const getBytesValue = (value: DatumValue, label: string) => {
  if (typeof value.bytes !== "string") {
    throw new Error(`Expected bytes for ${label}`);
  }

  return value.bytes;
};

export const getIntValue = (value: DatumValue, label: string) => {
  if (value.int === undefined) {
    throw new Error(`Expected int for ${label}`);
  }

  return BigInt(value.int);
};

export const getOptionValue = (
  value: DatumValue,
  label: string,
): DatumValue | null => {
  const constructor = getConstructorValue(value, label);
  const fields = getFields(value, label);

  if (constructor === 1) {
    return null;
  }

  if (constructor === 0) {
    return fields[0];
  }

  throw new Error(`Invalid option constructor for ${label}: ${constructor}`);
};

export const getOptionBytes = (value: DatumValue, label: string) => {
  const optionValue = getOptionValue(value, label);
  return optionValue ? getBytesValue(optionValue, label) : null;
};

export const getBytesList = (value: DatumValue, label: string) => {
  if (!Array.isArray(value.list)) {
    throw new Error(`Expected list for ${label}`);
  }

  return value.list.map((item, index) =>
    getBytesValue(item, `${label}[${index}]`),
  );
};

export const getQuantity = (assets: Asset[], unit: string) =>
  BigInt(assets.find((asset) => asset.unit === unit)?.quantity ?? "0");

export const pushAsset = (assets: Asset[], unit: string, quantity: bigint) => {
  if (quantity > 0n) {
    assets.push({ unit, quantity: quantity.toString() });
  }
};

export const serializeTestingAddress = (value: AddressValue) =>
  serializeAddressObj(value, NETWORK_ID);

const addThousandsSeparators = (value: string) =>
  value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const formatScaledValue = (value: bigint, decimals: number) => {
  const negative = value < 0n;
  const absoluteValue = negative ? -value : value;
  const scale = 10n ** BigInt(decimals);
  const whole = absoluteValue / scale;
  const fraction = absoluteValue % scale;
  const wholeLabel = addThousandsSeparators(whole.toString());
  const fractionLabel = fraction
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  const prefix = negative ? "-" : "";
  return fractionLabel
    ? `${prefix}${wholeLabel}.${fractionLabel}`
    : `${prefix}${wholeLabel}`;
};

export const formatAda = (value: bigint) =>
  `${formatScaledValue(value, 6)} ADA`;

export const formatUnits = (value: bigint, decimals = 6) =>
  formatScaledValue(value, decimals);

export const formatExchangeRate = (value: {
  numerator: bigint;
  denominator: bigint;
}) => {
  if (value.denominator === 0n) {
    return "0 ADA/token";
  }

  const scaledAdaPerToken =
    (value.numerator * 10n ** 6n) / (value.denominator * 1_000_000n);
  return `${formatScaledValue(scaledAdaPerToken, 6)} ADA/token`;
};

export const parseDecimalToInt = (value: string, decimals = 6) => {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("Enter an amount.");
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Enter a valid numeric amount.");
  }

  const [wholePart, fractionPart = ""] = normalized.split(".");
  const paddedFraction = `${fractionPart}${"0".repeat(decimals)}`.slice(0, decimals);

  return BigInt(wholePart) * 10n ** BigInt(decimals) + BigInt(paddedFraction);
};

export const parseBasketLockLabel = (value: {
  type: "Locked" | "Unlocked";
  lockedAt?: bigint;
  unlockedAt?: bigint;
}) =>
  value.type === "Locked"
    ? `Locked until ${formatTimestampMs(value.lockedAt, "an unknown time")}`
    : "Unlocked";
