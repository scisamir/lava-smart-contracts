"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@meshsdk/react";

const LOCAL_STORAGE_KEY = "connectedWallet";

export function useCardanoWallet() {
  const { wallet, connected, connect, disconnect, name } = useWallet();
  const [walletAddress, setWalletAddress] = useState("");
  const [balance, setBalance] = useState(0);

  // Reconnect last wallet from localStorage
  useEffect(() => {
    const lastWallet = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (lastWallet && !connected) {
      connect(lastWallet).catch(() => {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      });
    }
  }, [connect, connected]);

  // Fetch wallet address & balance whenever connected wallet changes
  useEffect(() => {
    const fetchWalletData = async () => {
      if (connected && wallet) {
        try {
          const addr = await wallet.getChangeAddress();
          setWalletAddress(addr);

          const assets = await wallet.getAssets();
          const adaAsset = assets.find((a) => a.unit === "lovelace");
          const balanceInAda = adaAsset ? Number(adaAsset.quantity) / 1_000_000 : 0;
          setBalance(balanceInAda);

          // Persist the connected wallet
          if (name) localStorage.setItem(LOCAL_STORAGE_KEY, name);
        } catch (err) {
          console.error("Error fetching wallet data:", err);
        }
      } else {
        setWalletAddress("");
        setBalance(0);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    };

    fetchWalletData();
  }, [connected, wallet, name]);

  // Override connect/disconnect to keep localStorage in sync
  const connectWallet = async (walletName: string) => {
    await connect(walletName);
    localStorage.setItem(LOCAL_STORAGE_KEY, walletName);
  };

  const disconnectWallet = async () => {
    await disconnect();
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  return {
    connected,
    wallet,
    walletName: name,
    walletAddress,
    balance,
    connect: connectWallet,
    disconnect: disconnectWallet,
  };
}
