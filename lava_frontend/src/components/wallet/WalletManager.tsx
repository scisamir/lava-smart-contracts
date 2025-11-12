"use client";
import { useState } from "react";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";
import { WalletConnectModal } from "./WalletConnectModal";
import { ConnectedWalletModal } from "./ConnectedWalletModal";

export default function WalletManager() {
  const { connected, connect, disconnect, walletAddress } = useCardanoWallet();
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectedModalOpen, setConnectedModalOpen] = useState(false);

  const handleConnect = async (walletName: string) => {
    try {
      await connect(walletName);
    } catch (err) {
      console.error("Wallet connection failed:", err);
    }
  };

  return (
    <div className="flex justify-center">
      {connected ? (
        <button
          onClick={() => setConnectedModalOpen(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg"
        >
          Connected
        </button>
      ) : (
        <button
          onClick={() => setConnectModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          Connect Wallet
        </button>
      )}

      <WalletConnectModal
        open={connectModalOpen}
        onOpenChange={setConnectModalOpen}
        onConnect={handleConnect}
      />

      <ConnectedWalletModal
        open={connectedModalOpen}
        onOpenChange={setConnectedModalOpen}
        walletAddress={walletAddress}
        onDisconnect={disconnect}
      />
    </div>
  );
}
