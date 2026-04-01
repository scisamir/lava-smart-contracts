import type { UTxO } from "@meshsdk/core";
import {
  addressToBech32,
  deserializeAddress as deserializeRawAddress,
  deserializeTxUnspentOutput,
  fromTxUnspentOutput,
} from "@meshsdk/core-cst";

const CONNECTED_WALLET_STORAGE_KEY = "lava_e2e_frontend_connected_wallet";

const formatLookupError = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const firstAddress = (addresses: string[]) =>
  addresses.find((address) => typeof address === "string" && address.length > 0);

type InjectedWalletProvider = {
  enable?: () => Promise<RawTestingWalletApi>;
};

type RawTestingWalletApi = {
  getUnusedAddresses?: () => Promise<string[]>;
  getUsedAddresses?: () => Promise<string[]>;
  getChangeAddress?: () => Promise<string>;
  getUtxos: () => Promise<string[] | null | undefined>;
  signTx: (tx: string, partialSign: boolean) => Promise<string>;
  submitTx: (tx: string) => Promise<string>;
};

export type WalletAddressLike = {
  getUnusedAddresses?: () => Promise<string[]>;
  getUsedAddresses?: () => Promise<string[]>;
  getChangeAddress?: () => Promise<string>;
};

export type TestingWallet = WalletAddressLike & {
  key: string;
  rawApi: RawTestingWalletApi;
  getUtxos: () => Promise<UTxO[]>;
  signTx: (tx: string, partialSign?: boolean) => Promise<string>;
  submitTx: (tx: string) => Promise<string>;
};

const normalizeWalletAddress = (rawAddress: string) => {
  if (
    rawAddress.startsWith("addr") ||
    rawAddress.startsWith("stake") ||
    rawAddress.startsWith("addr_test") ||
    rawAddress.startsWith("stake_test")
  ) {
    return rawAddress;
  }

  return addressToBech32(deserializeRawAddress(rawAddress));
};

const normalizeWalletAddresses = async (
  lookup: (() => Promise<string[]>) | undefined,
) => {
  if (!lookup) {
    return [];
  }

  const addresses = await lookup();
  return addresses.map(normalizeWalletAddress);
};

const normalizeWalletChangeAddress = async (
  lookup: (() => Promise<string>) | undefined,
) => {
  if (!lookup) {
    return "";
  }

  return normalizeWalletAddress(await lookup());
};

const wrapInjectedWallet = (
  walletKey: string,
  rawApi: RawTestingWalletApi,
): TestingWallet => ({
  key: walletKey,
  rawApi,
  getUnusedAddresses: () => normalizeWalletAddresses(rawApi.getUnusedAddresses),
  getUsedAddresses: () => normalizeWalletAddresses(rawApi.getUsedAddresses),
  getChangeAddress: () => normalizeWalletChangeAddress(rawApi.getChangeAddress),
  getUtxos: async () =>
    (await rawApi.getUtxos())?.map((rawUtxo) =>
      fromTxUnspentOutput(deserializeTxUnspentOutput(rawUtxo)),
    ) ?? [],
  signTx: (tx: string, partialSign = false) => rawApi.signTx(tx, partialSign),
  submitTx: (tx: string) => rawApi.submitTx(tx),
});

export const getStoredWalletKey = () =>
  typeof window === "undefined"
    ? null
    : window.localStorage.getItem(CONNECTED_WALLET_STORAGE_KEY);

export const storeWalletKey = (walletKey: string) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CONNECTED_WALLET_STORAGE_KEY, walletKey);
  }
};

export const clearStoredWalletKey = () => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(CONNECTED_WALLET_STORAGE_KEY);
  }
};

const waitForWalletInjection = async (
  walletKey: string,
  attempts = 30,
  delayMs = 100,
) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const cardano =
      typeof window === "undefined"
        ? undefined
        : (window as typeof window & {
            cardano?: Record<string, InjectedWalletProvider>;
          }).cardano;
    const wallet = cardano?.[walletKey];

    if (wallet?.enable) {
      return wallet;
    }

    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
  }

  return null;
};

export const connectTestingWallet = async (walletKey: string) => {
  const injectedWallet = await waitForWalletInjection(walletKey);

  if (!injectedWallet?.enable) {
    throw new Error(
      `Wallet extension "${walletKey}" is not available in this browser.`,
    );
  }

  const rawApi = await injectedWallet.enable();
  return wrapInjectedWallet(walletKey, rawApi);
};

export const restoreTestingWallet = async () => {
  const walletKey = getStoredWalletKey();
  return walletKey ? connectTestingWallet(walletKey) : null;
};

export const resolveWalletAddress = async (wallet: WalletAddressLike) => {
  const errors: string[] = [];

  if (wallet.getUnusedAddresses) {
    try {
      const address = firstAddress(await wallet.getUnusedAddresses());
      if (address) {
        return address;
      }
    } catch (error) {
      errors.push(`unused addresses: ${formatLookupError(error)}`);
    }
  }

  if (wallet.getUsedAddresses) {
    try {
      const address = firstAddress(await wallet.getUsedAddresses());
      if (address) {
        return address;
      }
    } catch (error) {
      errors.push(`used addresses: ${formatLookupError(error)}`);
    }
  }

  if (wallet.getChangeAddress) {
    try {
      const address = await wallet.getChangeAddress();
      if (address) {
        return address;
      }
    } catch (error) {
      errors.push(`change address: ${formatLookupError(error)}`);
    }
  }

  throw new Error(
    errors.length > 0
      ? `Unable to resolve a wallet address. ${errors.join("; ")}.`
      : "Unable to resolve a wallet address.",
  );
};
