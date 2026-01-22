"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@meshsdk/react";
import { BlockchainProviderType } from "@/e2e/types";
import {
  AssetExtended,
  deserializeAddress,
  MaestroProvider,
  MeshTxBuilder,
  stringToHex,
  UTxO,
} from "@meshsdk/core";
import { fetchPoolInfo } from "@/e2e/utils";
import { PoolInfo } from "@/lib/types";

const LOCAL_STORAGE_KEY = "connectedWallet";

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
  const [poolInfo, setPoolInfo] = useState<PoolInfo[]>([]);

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

        const assets = await wallet.getAssets();
        const adaAsset = assets.find((a) => a.unit === "lovelace");
        setBalance(
          adaAsset ? Number(adaAsset.quantity) / 1_000_000 : 0
        );

        const { pubKeyHash, stakeCredentialHash } =
          deserializeAddress(addr);

        const walletUtxos = await wallet.getUtxos();
        const walletCollateral =
          walletUtxos.filter(
            (utxo) =>
              Number(utxo.output.amount[0].quantity) >= 7_000_000 &&
              utxo.output.amount.length <= 4
          )[0] ?? null;

        if (name) localStorage.setItem(LOCAL_STORAGE_KEY, name);

        const maestroKey = process.env.NEXT_PUBLIC_MAESTRO_KEY;
        if (!maestroKey) throw new Error("MAESTRO_KEY missing");

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

        const test = getTokenBalance(
          assets,
          "def68337867cb4f1f95b6b811fedbfcdd7780d10a95cc072077088ea",
          "test"
        );
        const stTest = getTokenBalance(
          assets,
          "9c1dd9791eba86728634ec4d1531ff3f7ace179c3f8b1e75bfbf1906",
          "stTest"
        );
        const tStrike = getTokenBalance(
          assets,
          "def68337867cb4f1f95b6b811fedbfcdd7780d10a95cc072077088ea",
          "tStrike"
        );
        const LStrike = getTokenBalance(
          assets,
          "9c1dd9791eba86728634ec4d1531ff3f7ace179c3f8b1e75bfbf1906",
          "LStrike"
        );
        const tPulse = getTokenBalance(
          assets,
          "def68337867cb4f1f95b6b811fedbfcdd7780d10a95cc072077088ea",
          "tPulse"
        );
        const LPulse = getTokenBalance(
          assets,
          "9c1dd9791eba86728634ec4d1531ff3f7ace179c3f8b1e75bfbf1906",
          "LPulse"
        );

        const poolInfoData = await fetchPoolInfo(bp);

        setTxBuilder(tb);
        setBlockchainProvider(bp);
        setWalletVK(pubKeyHash);
        setWalletSK(stakeCredentialHash ?? "");
        setWalletCollateral(walletCollateral);
        setWalletUtxos(walletUtxos);
        setTokenBalances({
          test,
          stTest,
          tStrike,
          LStrike,
          tPulse,
          LPulse,
        });
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
