"use client";

import {
  ReactNode,
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWallet } from "@meshsdk/react";
import {
  AssetExtended,
  deserializeAddress,
  MaestroProvider,
  MeshTxBuilder,
  stringToHex,
  UTxO,
} from "@meshsdk/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BackendVault } from "@/lib/types";

const LOCAL_STORAGE_KEY = "connectedWallet";

const getBackendBaseUrl = () =>
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/lava-vaults\/?$/, "") ||
  "https://xk00c9isg3.execute-api.us-east-1.amazonaws.com/prod";

let backendUrlLogged = false;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const HOME_DATA_REFRESH_EVENT = "lava:refresh-home-data";

type WalletBalanceResponse = {
  balance?: number;
  tokenBalances?: Record<string, number>;
  walletUtxos?: UTxO[];
  collateral?: UTxO | null;
};

const fetchWalletBalance = async (address: string): Promise<WalletBalanceResponse> => {
  const backendBaseUrl = getBackendBaseUrl();
  const balanceRes = await fetch(
    `${backendBaseUrl}/user-balance?address=${encodeURIComponent(address)}`
  );

  if (!balanceRes.ok) {
    throw new Error(`Failed to fetch user balance: ${balanceRes.status}`);
  }

  return balanceRes.json();
};

const fetchVaults = async (): Promise<BackendVault[]> => {
  const backendBaseUrl = getBackendBaseUrl();
  const vaultsRes = await fetch(`${backendBaseUrl}/lava-vaults`);

  if (!vaultsRes.ok) {
    throw new Error(`Failed to fetch lava vaults: ${vaultsRes.status}`);
  }

  const vaultsData = await vaultsRes.json();

  return (vaultsData.vaults ?? []).map((vault: any) => ({
    name: String(vault.name ?? ""),
    logo: String(vault.logo ?? ""),
    score: String(vault.score ?? "0"),
    status: String(vault.status ?? "Closed"),
    recentBlocks: Number(vault.recentBlocks ?? 0),
    stStake: String(vault.stStake ?? "0"),
    staked: String(vault.staked ?? "0"),
    tokenPair: vault.tokenPair ?? { base: "", derivative: "" },
    tokenDetails: vault.tokenDetails ?? null,
    poolStakeAssetNameHex: String(vault.poolStakeAssetNameHex ?? ""),
  }));
};

function useCardanoWalletState() {
  const { wallet, connected, connect, disconnect, name } = useWallet();
  const queryClient = useQueryClient();
  const backendBaseUrl = getBackendBaseUrl();

  const [walletAddress, setWalletAddress] = useState("");
  // Keep these for backward compatibility with existing context consumers.
  // They are intentionally not initialized from any public env var.
  const [txBuilder] = useState<MeshTxBuilder | null>(null);
  const [blockchainProvider] = useState<MaestroProvider | null>(null);
  const [walletVK, setWalletVK] = useState<string>("");
  const [walletSK, setWalletSK] = useState<string>("");
  const restoreStartedRef = useRef(false);
  const lastWalletSnapshotRef = useRef<string | null>(null);

  //CRITICAL FLAG
  const [hasTriedRestore, setHasTriedRestore] = useState(false);

  // Helpers
  const getTokenBalance = (
    assets: AssetExtended[],
    policyId: string,
    assetName: string
  ): number => {
    const assetHex = stringToHex(assetName);
    const unit = policyId + assetHex;

    return Number(
      assets.find((ast) => ast.unit === unit)?.quantity ?? "0"
    );
  };

  useEffect(() => {
    const restoreWallet = async () => {
      if (restoreStartedRef.current) {
        return;
      }
      restoreStartedRef.current = true;

      const lastWallet = localStorage.getItem(LOCAL_STORAGE_KEY);

      if (!lastWallet || connected) {
        setHasTriedRestore(true);
        return;
      }

      // Poll for wallet availability
      let attempts = 0;
      const maxAttempts = 30;
      while (attempts < maxAttempts) {
        const cardano = (window as any).cardano;
        if (cardano?.[lastWallet]) {
          try {
            await connect(lastWallet);
            break;
          } catch (err) {
            console.warn("Wallet restore failed:", err);
            
            break;
          }
        }
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setHasTriedRestore(true);
    };

    restoreWallet();
  }, [connect, connected]);

  useEffect(() => {
    const setAddressAndKeys = async () => {
      if (!(connected && wallet)) {
        //DO NOT CLEAR UNTIL RESTORE FINISHED
        if (!hasTriedRestore) return;

        setWalletAddress("");
        setWalletVK("");
        setWalletSK("");
        return;
      }

      try {
        const addr = await wallet.getChangeAddress();
        setWalletAddress(addr);

        const { pubKeyHash, stakeCredentialHash } = deserializeAddress(addr);
        setWalletVK(pubKeyHash);
        setWalletSK(stakeCredentialHash ?? "");

        if (name) localStorage.setItem(LOCAL_STORAGE_KEY, name);
      } catch (err) {
        console.error("Error resolving wallet address:", err);
      }
    };

    setAddressAndKeys();
  }, [connected, wallet, name, hasTriedRestore]);

  useEffect(() => {
    if (!backendUrlLogged) {
      console.info("[Lava] Frontend backend base URL:", backendBaseUrl);
      backendUrlLogged = true;
    }
  }, [backendBaseUrl]);

  const walletBalanceQuery = useQuery({
    queryKey: ["wallet-balance", walletAddress],
    queryFn: () => fetchWalletBalance(walletAddress),
    enabled: connected && !!walletAddress,
    staleTime: 30_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: connected && !!walletAddress ? 30_000 : false,
    refetchIntervalInBackground: false,
    placeholderData: (previousData) => previousData,
  });

  const vaultsQuery = useQuery({
    queryKey: ["lava-vaults"],
    queryFn: fetchVaults,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 3_600_000,
    refetchIntervalInBackground: false,
    placeholderData: (previousData) => previousData,
  });

  const balance = useMemo(
    () => (connected ? Number(walletBalanceQuery.data?.balance ?? 0) : 0),
    [connected, walletBalanceQuery.data?.balance]
  );
  const tokenBalances = useMemo(
    () => (connected ? walletBalanceQuery.data?.tokenBalances ?? {} : {}),
    [connected, walletBalanceQuery.data?.tokenBalances]
  );
  const walletUtxos = useMemo(
    () => (connected ? ((walletBalanceQuery.data?.walletUtxos ?? []) as UTxO[]) : []),
    [connected, walletBalanceQuery.data?.walletUtxos]
  );
  const walletCollateral = useMemo(
    () => (connected ? ((walletBalanceQuery.data?.collateral ?? null) as UTxO | null) : null),
    [connected, walletBalanceQuery.data?.collateral]
  );
  const poolInfo = useMemo(
    () => vaultsQuery.data ?? [],
    [vaultsQuery.data]
  );
  const vaultsError = useMemo(
    () =>
      vaultsQuery.error instanceof Error
        ? vaultsQuery.error.message
        : vaultsQuery.error
        ? String(vaultsQuery.error)
        : null,
    [vaultsQuery.error]
  );

  useEffect(() => {
    if (!connected || !walletAddress) {
      lastWalletSnapshotRef.current = null;
      return;
    }

    const snapshot = JSON.stringify({
      balance,
      tokenBalances,
    });

    if (lastWalletSnapshotRef.current === null) {
      lastWalletSnapshotRef.current = snapshot;
      return;
    }

    if (lastWalletSnapshotRef.current !== snapshot) {
      lastWalletSnapshotRef.current = snapshot;
      window.dispatchEvent(new CustomEvent(HOME_DATA_REFRESH_EVENT));
    }
  }, [connected, walletAddress, balance, tokenBalances]);


  // Public API

  const connectWallet = async (walletName: string) => {
    await connect(walletName);
    localStorage.setItem(LOCAL_STORAGE_KEY, walletName);
  };

  const disconnectWallet = async () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    await disconnect();
    queryClient.removeQueries({ queryKey: ["wallet-balance"] });
  };

  const reloadWalletState = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["wallet-balance", walletAddress] }),
      queryClient.invalidateQueries({ queryKey: ["lava-vaults"] }),
    ]);
  };

  const refreshWalletStateAfterTx = async () => {
    await reloadWalletState();

    const attempts = 8;
    for (let i = 0; i < attempts; i++) {
      await sleep(2_500);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["wallet-balance", walletAddress], type: "active" }),
        queryClient.refetchQueries({ queryKey: ["lava-vaults"], type: "active" }),
      ]);
    }
  };

  return {
    connected,
    wallet,
    walletName: name,
    walletAddress,
    balance,
    tokenBalances,
    connect: connectWallet,
    disconnect: disconnectWallet,
    reloadWalletState,
    refreshWalletStateAfterTx,
    blockchainProvider,
    txBuilder,
    walletVK,
    walletSK,
    walletCollateral,
    walletUtxos,
    getTokenBalance,
    poolInfo,
    backendBaseUrl,
    vaultsLoading: vaultsQuery.isLoading,
    vaultsError,
  };
}

type CardanoWalletContextValue = ReturnType<typeof useCardanoWalletState>;

const CardanoWalletContext = createContext<CardanoWalletContextValue | null>(null);

export function CardanoWalletProvider({ children }: { children: ReactNode }) {
  const value = useCardanoWalletState();

  return createElement(CardanoWalletContext.Provider, { value }, children);
}

export function useCardanoWallet() {
  const context = useContext(CardanoWalletContext);

  if (!context) {
    throw new Error("useCardanoWallet must be used inside CardanoWalletProvider");
  }

  return context;
}
