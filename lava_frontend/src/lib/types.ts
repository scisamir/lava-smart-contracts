export type UserOrderType = {
  amount: number;
  txHash: string;
  outputIndex?: number;
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
  { base: "ADA", derivative: "LADA" },
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
  tokenDetails?: {
    derivative?: {
      symbol?: string;
      displayName?: string;
      policyId?: string;
      assetNameHex?: string;
      decimals?: number;
      logo?: string;
    };
    base?: {
      symbol?: string;
      displayName?: string;
      policyId?: string;
      assetNameHex?: string;
      decimals?: number;
      logo?: string;
    };
  } | null;
  poolStakeAssetNameHex?: string;
};
