"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@meshsdk/react";
import {
  addressToBech32,
  deserializeAddress as deserializeCardanoAddress,
} from "@meshsdk/core-cst";
import { BlockchainProviderType } from "@/e2e/types";
import {
  AssetExtended,
  deserializeAddress,
  MaestroProvider,
  MeshTxBuilder,
  stringToHex,
  UTxO,
} from "@meshsdk/core";
import { BackendVault } from "@/lib/types";
import { fetchBackend } from "@/lib/backendClient";
import { clearWalletAuthSession, ensureWalletAuthSession } from "@/lib/walletAuth";

const LOCAL_STORAGE_KEY = "connectedWallet";
const MAESTRO_NETWORK = "Preprod";

const createTransactionContext = () => {
  const apiKey = process.env.NEXT_PUBLIC_MAESTRO_API_KEY?.trim();
  if (!apiKey) {
    return { provider: null, builder: null };
  }
  const provider = new MaestroProvider({ network: MAESTRO_NETWORK, apiKey });
  return {
    provider,
    builder: new MeshTxBuilder({ fetcher: provider, submitter: provider, evaluator: provider }),
  };
};

const normalizeWalletAddress = (rawAddress: string): string => {
  if (!rawAddress) {
    return "";
  }

  if (rawAddress.startsWith("addr") || rawAddress.startsWith("stake")) {
    return rawAddress;
  }

  return addressToBech32(deserializeCardanoAddress(rawAddress));
};

export function useCardanoWallet() {
  const { wallet, connected, connect, disconnect, name } = useWallet();

  const [walletAddress, setWalletAddress] = useState("");
  const [balance, setBalance] = useState(0);
  const [txBuilder, setTxBuilder] = useState<MeshTxBuilder | null>(null);
  const [blockchainProvider, setBlockchainProvider] =
    useState<BlockchainProviderType | null>(null);
  const [walletVK, setWalletVK] = useState<string>("");
  const [walletSK, setWalletSK] = useState<string>("");
  const [walletUtxos, setWalletUtxos] = useState<UTxO[]>([]);
  const [walletCollateral, setWalletCollateral] = useState<UTxO | null>(null);

  const [tokenBalances, setTokenBalances] = useState<{ [key: string]: number }>(
    {}
  );
  const [poolInfo, setPoolInfo] = useState<BackendVault[]>([]);

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
      const lastWallet = localStorage.getItem(LOCAL_STORAGE_KEY);

      if (!lastWallet || connected) {
        setHasTriedRestore(true);
        return;
      }

      // Delay to allow wallet extension to load
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Poll for wallet availability
      let attempts = 0;
      const maxAttempts = 50;
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
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms before next check
      }

      setHasTriedRestore(true);
    };

    restoreWallet();
  }, [connect, connected]);

  // Fetch Wallet Data
  const fetchWalletData = async () => {
    if (connected && wallet) {
      try {
        const rawChangeAddress = await wallet.getChangeAddress();
        const changeAddress =
          typeof (wallet as any).getChangeAddressBech32 === "function"
            ? await (wallet as any).getChangeAddressBech32()
            : rawChangeAddress;
        const usedAddresses =
          typeof (wallet as any).getUsedAddressesBech32 === "function"
            ? await (wallet as any).getUsedAddressesBech32()
            : typeof (wallet as any).getUsedAddresses === "function"
              ? await (wallet as any).getUsedAddresses()
              : [];
        const normalizedChangeAddress = normalizeWalletAddress(changeAddress);
        const normalizedUsedAddresses = usedAddresses
          .map((address: string) => normalizeWalletAddress(address))
          .filter(Boolean);
        const authAddress = normalizedChangeAddress || normalizedUsedAddresses[0] || "";

        if (!authAddress) {
          throw new Error("Wallet did not provide a usable Cardano address");
        }

        setWalletAddress(authAddress);

        const authSession = await ensureWalletAuthSession(
          wallet as any,
          authAddress,
          rawChangeAddress
        );
        const balanceRes = await fetchBackend('/user-balance', {
          token: authSession.token,
        });

        if (!balanceRes.ok) {
          throw new Error(`Failed to fetch user balance: ${balanceRes.status}`);
        }

        const balanceData = await balanceRes.json();

        setBalance(Number(balanceData.balance ?? 0));
        setTokenBalances(balanceData.tokenBalances ?? {});
        setWalletUtxos((balanceData.walletUtxos ?? []) as UTxO[]);
        setWalletCollateral((balanceData.collateral ?? null) as UTxO | null);

        const { pubKeyHash, stakeCredentialHash } = deserializeAddress(authAddress);

        if (name) localStorage.setItem(LOCAL_STORAGE_KEY, name);

        const vaultsRes = await fetchBackend('/lava-vaults');
        if (!vaultsRes.ok) {
          throw new Error(`Failed to fetch lava vaults: ${vaultsRes.status}`);
        }

        const vaultsData = await vaultsRes.json();
        const poolInfoData: BackendVault[] = (vaultsData.vaults ?? []).map(
          (vault: any) => ({
            name: String(vault.name ?? ""),
            logo: String(vault.logo ?? ""),
            score: String(vault.score ?? "0"),
            status: String(vault.status ?? "Closed"),
            recentBlocks: Number(vault.recentBlocks ?? 0),
            stStake: String(vault.stStake ?? "0"),
            staked: String(vault.staked ?? "0"),
            tokenPair: vault.tokenPair ?? { base: "", derivative: "" },
          })
        );

        const { provider, builder } = createTransactionContext();
        setTxBuilder(builder);
        setBlockchainProvider(provider);
        setWalletVK(pubKeyHash);
        setWalletSK(stakeCredentialHash ?? "");
        setPoolInfo(poolInfoData);
      } catch (err) {
        console.error("Error fetching wallet data:", err);
      }
      return;
    }

    //DO NOT CLEAR UNTIL RESTORE FINISHED
    if (!hasTriedRestore) return;

    clearWalletAuthSession();

    // Only clear UI state (not localStorage)
    setWalletAddress("");
    setBalance(0);
    setTxBuilder(null);
    setBlockchainProvider(null);
    setWalletCollateral(null);
    setWalletUtxos([]);
    setTokenBalances({});
    setPoolInfo([]);
  };

  useEffect(() => {
    fetchWalletData();
  }, [connected, wallet, name, hasTriedRestore]);


  // Public API

  const connectWallet = async (walletName: string) => {
    await connect(walletName);
    localStorage.setItem(LOCAL_STORAGE_KEY, walletName);
  };

  const disconnectWallet = async () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    clearWalletAuthSession();
    await disconnect();
  };

  const reloadWalletState = async () => {
    await fetchWalletData();
  };

  return {
    connected,
    wallet,
    walletName: name,
    currentUserAddress: walletAddress,
    walletAddress,
    balance,
    tokenBalances,
    connect: connectWallet,
    disconnect: disconnectWallet,
    reloadWalletState,
    blockchainProvider,
    txBuilder,
    walletVK,
    walletSK,
    walletCollateral,
    walletUtxos,
    getTokenBalance,
    poolInfo,
  };
}
