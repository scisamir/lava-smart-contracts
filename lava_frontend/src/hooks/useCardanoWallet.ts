"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@meshsdk/react";
import {
  AssetExtended,
  deserializeAddress,
  MaestroProvider,
  MeshTxBuilder,
  stringToHex,
  UTxO,
} from "@meshsdk/core";
import { BackendVault } from "@/lib/types";

const LOCAL_STORAGE_KEY = "connectedWallet";

export function useCardanoWallet() {
  const { wallet, connected, connect, disconnect, name } = useWallet();

  const [walletAddress, setWalletAddress] = useState("");
  const [balance, setBalance] = useState(0);
  const [txBuilder, setTxBuilder] = useState<MeshTxBuilder | null>(null);
  const [blockchainProvider, setBlockchainProvider] =
    useState<MaestroProvider | null>(null);
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
        const addr = await wallet.getChangeAddress();
        setWalletAddress(addr);

        const backendBaseUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/lava-vaults\/?$/, "") ||
          "https://0lth59w8rl.execute-api.us-east-1.amazonaws.com/prod";

        const balanceRes = await fetch(
          `${backendBaseUrl}/user-balance?address=${encodeURIComponent(addr)}`
        );

        if (!balanceRes.ok) {
          throw new Error(`Failed to fetch user balance: ${balanceRes.status}`);
        }

        const balanceData = await balanceRes.json();

        setBalance(Number(balanceData.balance ?? 0));
        setTokenBalances(balanceData.tokenBalances ?? {});
        setWalletUtxos((balanceData.walletUtxos ?? []) as UTxO[]);
        setWalletCollateral((balanceData.collateral ?? null) as UTxO | null);

        const { pubKeyHash, stakeCredentialHash } =
          deserializeAddress(addr);

        if (name) localStorage.setItem(LOCAL_STORAGE_KEY, name);

        const maestroKey = process.env.NEXT_PUBLIC_MAESTRO_KEY;
        if (maestroKey) {
          const bp = new MaestroProvider({
            network: "Preprod",
            apiKey: maestroKey,
          });

          const tb = new MeshTxBuilder({
            fetcher: bp,
            submitter: bp,
            evaluator: bp,
            verbose: true,
          });
          tb.setNetwork("preprod");

          setTxBuilder(tb);
          setBlockchainProvider(bp);
        } else {
          setTxBuilder(null);
          setBlockchainProvider(null);
          console.warn("NEXT_PUBLIC_MAESTRO_KEY is not set; frontend tx builder/provider disabled.");
        }

        const vaultsRes = await fetch(`${backendBaseUrl}/lava-vaults`);
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
    await disconnect();
  };

  const reloadWalletState = async () => {
    await fetchWalletData();
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
