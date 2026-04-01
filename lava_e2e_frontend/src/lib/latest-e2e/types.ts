import type { UTxO } from "@meshsdk/core";

export type OrderKind = "deposit" | "redeem";

export type AtriumOrder = {
  id: string;
  txHash: string;
  outputIndex: number;
  kind: OrderKind;
  amount: bigint;
  receiverAddress: string;
  wrapperLovelace: bigint;
  stakeLocked: bigint;
  utxo: UTxO;
};

export type SnapshotOrder = {
  id: string;
  txHash: string;
  outputIndex: string;
  kind: OrderKind;
  amount: bigint;
  receiverAddress: string;
  wrapperLovelace: bigint;
};

export type PoolSnapshot = {
  txRef: string;
  nftUnit: string;
  nftName: string;
  totalUnderlying: bigint;
  totalStAssetsMinted: bigint;
  exchangeRate: bigint;
  totalRewardsAccrued: bigint;
  availableToStake: bigint;
  isProcessingOpen: boolean;
};

export type AtriumSnapshot = {
  basketExchangeRateLabel: string;
  basketLockLabel: string;
  pledgeLockLabel: string;
  rewardDiffusion: bigint;
  rewardWrapperLovelace: bigint;
  estimatedAdaFromRewards: bigint;
  basketTokenCounter: bigint;
  stakePoolLovelace: bigint;
  selectedRewardRef: string | null;
};

export type TestingSnapshot = {
  network: "mainnet" | "preprod";
  userOrders: SnapshotOrder[];
  orderStats: {
    totalPending: number;
    depositCount: number;
    redeemCount: number;
    totalDepositAmount: bigint;
    totalRedeemAmount: bigint;
  };
  pool: PoolSnapshot;
  atrium: AtriumSnapshot;
  warnings: string[];
};
