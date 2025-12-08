"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@meshsdk/react";
import { BlockchainProviderType } from "@/e2e/types";
import { deserializeAddress, MaestroProvider, MeshTxBuilder, UTxO } from "@meshsdk/core";

const LOCAL_STORAGE_KEY = "connectedWallet";

export function useCardanoWallet() {
  const { wallet, connected, connect, disconnect, name } = useWallet();
  const [walletAddress, setWalletAddress] = useState("");
  const [balance, setBalance] = useState(0);
  const [txBuilder, setTxBuilder] = useState<MeshTxBuilder | null>(null);
  const [blockchainProvider, setBlockchainProvider] = useState<BlockchainProviderType | null>(null);
  const [walletVK, setWalletVK] = useState<string>("");
  const [walletSK, setWalletSK] = useState<string>("");
  const [walletUtxos, setWalletUtxos] = useState<UTxO[]>([]);
  const [walletCollateral, setWalletCollateral] = useState<UTxO | null>(null);

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

          const { pubKeyHash: walletVK, stakeCredentialHash: walletSK } = deserializeAddress(addr);
          const walletUtxos = await wallet.getUtxos();
          // const walletCollateral = (walletUtxos.filter(utxo => (utxo.output.amount.length === 1 && (Number(utxo.output.amount[0].quantity) >= 5000000 && Number(utxo.output.amount[0].quantity) <= 100000000))))[0];
          const walletCollateral = walletUtxos.filter(utxo => Number(utxo.output.amount[0].quantity) >= 5000000)[0];

          // Persist the connected wallet
          if (name) localStorage.setItem(LOCAL_STORAGE_KEY, name);

          const maestroKey = process.env.NEXT_PUBLIC_MAESTRO_KEY;
          if (!maestroKey) {
            throw new Error("MAESTRO_KEY does not exist");
          }

          const bp = new MaestroProvider({
            network: 'Preprod',
            apiKey: maestroKey,
          });
          const tb = new MeshTxBuilder({
            fetcher: bp,
            submitter: bp,
            evaluator: bp,
            verbose: true,
          });
          tb.setNetwork('preprod');

          setTxBuilder(tb);
          setBlockchainProvider(bp);
          setWalletVK(walletVK);
          setWalletSK(walletSK);
          setWalletCollateral(walletCollateral);
          setWalletUtxos(walletUtxos);
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
    blockchainProvider,
    txBuilder,
    walletVK,
    walletSK,
    walletCollateral,
    walletUtxos,
  };
}
