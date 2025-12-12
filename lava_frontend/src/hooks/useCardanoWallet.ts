"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@meshsdk/react";
import { BlockchainProviderType } from "@/e2e/types";
import {
  deserializeAddress,
  MaestroProvider,
  MeshTxBuilder,
  UTxO,
} from "@meshsdk/core";

const LOCAL_STORAGE_KEY = "connectedWallet";

// Convert UTF-8 asset name → hex (Cardano format)
const toHex = (text: string) =>
  Buffer.from(text, "utf8").toString("hex");

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

  const [testBalance, setTestBalance] = useState(0);
  const [stTestBalance, setStTestBalance] = useState(0);

  // Helper to get token balance from current walletUtxos
  const getTokenBalance = (policyId: string, assetName: string): number => {
    if (!walletUtxos.length) return 0;

    const assetHex = toHex(assetName);
    const unit = policyId + assetHex;

    let total = 0;

    walletUtxos.forEach((utxo) => {
      utxo.output.amount.forEach((amt) => {
        if (amt.unit === unit) {
          total += Number(amt.quantity);
        }
      });
    });

    return total;
  };

  // Reconnect last used wallet
  useEffect(() => {
    const lastWallet = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (lastWallet && !connected) {
      connect(lastWallet).catch(() => localStorage.removeItem(LOCAL_STORAGE_KEY));
    }
  }, [connect, connected]);

  // Fetch wallet data (UTxOs and token balances)
  useEffect(() => {
    const fetchWallet = async () => {
      if (!connected || !wallet) {
        setWalletAddress("");
        setBalance(0);
        setWalletUtxos([]);
        setTestBalance(0);
        setStTestBalance(0);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        return;
      }

      try {
        const addr = await wallet.getChangeAddress();
        setWalletAddress(addr);

        const utxos = await wallet.getUtxos();
        setWalletUtxos(utxos);

        //ADA balance calculation removed. set balance to 0
        setBalance(0);

        const { pubKeyHash, stakeCredentialHash } = deserializeAddress(addr);
        setWalletVK(pubKeyHash ?? "");
        setWalletSK(stakeCredentialHash ?? "");

        const walletCollateral = utxos.filter(
          (u) => Number(u.output.amount[0].quantity) >= 5_000_000
        )[0];
        setWalletCollateral(walletCollateral);

        if (name) localStorage.setItem(LOCAL_STORAGE_KEY, name);

        const maestroKey = process.env.NEXT_PUBLIC_MAESTRO_KEY;
        if (!maestroKey) throw new Error("Missing Maestro API key");

        const provider = new MaestroProvider({
          network: "Preprod",
          apiKey: maestroKey,
        });

        const tb = new MeshTxBuilder({
          fetcher: provider,
          submitter: provider,
          evaluator: provider,
          verbose: true,
        });
        tb.setNetwork("preprod");

        setBlockchainProvider(provider);
        setTxBuilder(tb);

        // Fetch test and stTest balances
        const test = getTokenBalance(
          "def68337867cb4f1f95b6b811fedbfcdd7780d10a95cc072077088ea",
          "test"
        );
        const stTest = getTokenBalance(
          "c91f6168d72eb3d1f5db0636fedfde2e5e4bc08726fefc857f611e71",
          "stTest"
        );

        setTestBalance(test);
        setStTestBalance(stTest);
      } catch (err) {
        console.error("Wallet load error:", err);
      }
    };

    fetchWallet();
  }, [connected, wallet, name]);

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
    testBalance,
    stTestBalance,
    connect: connectWallet,
    disconnect: disconnectWallet,
    blockchainProvider,
    txBuilder,
    walletVK,
    walletSK,
    walletCollateral,
    walletUtxos,
    getTokenBalance,
  };
}
