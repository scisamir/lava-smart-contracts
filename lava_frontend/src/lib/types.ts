export type UserOrderType = {
  amount: number;
  txHash: string;
  isOptIn: boolean;
  tokenName: string;
};

export interface OrderListProps {
  orders: UserOrderType[];
}

export type TokenPair = {
  base: string;
  derivative: string;
};

export const TOKEN_PAIRS: TokenPair[] = [
  { base: "test", derivative: "stTest" },
  { base: "tStrike", derivative: "LStrike" },
  { base: "tPulse", derivative: "LPulse" },
];

export type PoolInfo = {
  name: string;
  isPoolOpen: boolean;
  totalUnderlying: number;
  totalStAssetsMinted: number;
};

export type BackendVault = {
  name: string;
  logo: string;
  score: string;
  status: string;
  recentBlocks: number;
  stStake: string;
  staked: string;
  tokenPair: TokenPair;
};
