import {
  hexToBytes,
  mConStr0,
  mConStr1,
  mConStr2,
  mConStr3,
  serializePlutusScript,
} from "@meshsdk/core";
import blakejs from "blakejs";

const { blake2bHex } = blakejs;

const falseData = () => mConStr0([]);
const trueData = () => mConStr1([]);

const some = (value: any) => mConStr0([value]);
const none = () => mConStr1([]);

const verificationKeySigner = (verificationKeyHash: string) =>
  mConStr0([verificationKeyHash]);

const spendScriptSigner = (scriptHash: string) => mConStr1([scriptHash]);

const withdrawScriptSigner = (scriptHash: string) => mConStr2([scriptHash]);

const mintScriptSigner = (scriptHash: string) => mConStr3([scriptHash]);

const scriptCredential = (scriptHash: string) => mConStr1([scriptHash]);

const assetType = (
  policyId: string,
  assetName: string,
  multiplier: number | bigint,
  isStable = false,
) =>
  mConStr0([
    isStable ? trueData() : falseData(),
    policyId,
    assetName,
    multiplier,
  ]);

const stakeType = (
  poolAsset: any,
  poolStakeAssetName: string,
  address: any | undefined,
  datumVerifierHash: string | undefined,
  rewardsValidatorHash: string,
) =>
  mConStr0([
    poolAsset,
    poolStakeAssetName,
    address ? some(address) : none(),
    datumVerifierHash ? some(datumVerifierHash) : none(),
    rewardsValidatorHash,
  ]);

const globalSettingsDatum = (
  admin: any,
  authorizedBatchers: any[],
  allowedAssets: any[],
  mintValidatorHash: string,
  stakeDetails: any[],
  frostAddress: any,
  authorizedSwapScripts: string[],
  stakeValidatorHash: string,
  minPoolLovelace: number | bigint,
) =>
  mConStr0([
    admin,
    authorizedBatchers,
    allowedAssets,
    mintValidatorHash,
    stakeDetails,
    frostAddress,
    authorizedSwapScripts,
    stakeValidatorHash,
    minPoolLovelace,
  ]);

const optInOrderType = (depositAmount: number | bigint) => mConStr0([depositAmount]);

const redeemOrderType = (stAmount: number | bigint) => mConStr1([stAmount]);

const orderDatum = (
  orderType: any,
  receiverAddress: any,
  canceller: any,
  poolStakeAssetName: string,
) => mConStr0([orderType, receiverAddress, canceller, poolStakeAssetName]);

const poolDatum = (
  poolBatchingCredential: any,
  totalStAssetsMinted: number | bigint,
  totalUnderlying: number | bigint,
  exchangeRate: number | bigint,
  totalRewardsAccrued: number | bigint,
  poolAsset: any,
  poolStakeAssetName: string,
  isProcessingOpen: boolean,
) =>
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

const outputReferenceData = (txHash: string, outputIndex: number | bigint) =>
  mConStr0([txHash, outputIndex]);

const computePoolNftName = (txHash: string, outputIndex: number) => {
  const txHashBytes = hexToBytes(txHash);
  const outputIndexBytes = Uint8Array.from(
    Array.from(String(outputIndex)).map((char) => char.charCodeAt(0)),
  );
  const payload = new Uint8Array(txHashBytes.length + outputIndexBytes.length);

  payload.set(txHashBytes);
  payload.set(outputIndexBytes, txHashBytes.length);

  return blake2bHex(payload, undefined, 28);
};

const serializeSelfStakedValidatorAddress = (
  script: string,
  scriptHash: string,
  networkId = 0,
) =>
  serializePlutusScript(
    { code: script, version: "V3" },
    scriptHash,
    networkId,
    true,
  ).address;

export {
  assetType,
  computePoolNftName,
  globalSettingsDatum,
  mintScriptSigner,
  none,
  optInOrderType,
  orderDatum,
  outputReferenceData,
  poolDatum,
  redeemOrderType,
  scriptCredential,
  serializeSelfStakedValidatorAddress,
  some,
  spendScriptSigner,
  stakeType,
  trueData,
  falseData,
  verificationKeySigner,
  withdrawScriptSigner,
};
