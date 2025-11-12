"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WalletConnectModal } from "./wallet/WalletConnectModal";
import { ConnectedWalletModal } from "./wallet/ConnectedWalletModal";
import { LAVA_LOGO } from "@/lib/images";
import { useCardanoWallet } from "@/hooks/useCardanoWallet"; // ✅ our custom hook

const Navigation = () => {
  const { connected, connect, disconnect, walletAddress } = useCardanoWallet();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  const handleConnect = async (walletName: string) => {
    try {
      await connect(walletName);
      setShowConnectModal(false);
      console.log(`Connected to ${walletName}`);
    } catch (error) {
      console.error("Wallet connection failed:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setShowWalletModal(false);
      console.log("Wallet disconnected");
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  };

  const truncateAddress = (address: string) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-2xl font-bold">
                <img src={LAVA_LOGO.src} alt="Lava" className="w-8 h-8" />
                <span className="text-foreground">lava</span>
              </div>
            </Link>

            {/* Nav Links */}
            <div className="hidden md:flex items-center gap-8">
              <Link
                href="/stake"
                className="text-foreground hover:text-primary transition-colors"
              >
                Stake
              </Link>
              <Link
                href="/earn"
                className="text-foreground hover:text-primary transition-colors"
              >
                Earn
              </Link>
              <Link
                href="/validators"
                className="text-foreground hover:text-primary transition-colors"
              >
                Validators
              </Link>
            </div>

            {/* Wallet Button */}
            <Button
              onClick={() =>
                connected
                  ? setShowWalletModal(true)
                  : setShowConnectModal(true)
              }
              className="bg-gradient-lava hover:opacity-90 transition-opacity shadow-glow"
            >
              <span className="mr-2">🔗</span>
              {connected && walletAddress
                ? truncateAddress(walletAddress)
                : "Connect Wallet"}
            </Button>
          </div>
        </div>
      </nav>

      {/* Wallet Modals */}
      <WalletConnectModal
        open={showConnectModal}
        onOpenChange={setShowConnectModal}
        onConnect={handleConnect}
      />

      {walletAddress && (
        <ConnectedWalletModal
          open={showWalletModal}
          onOpenChange={setShowWalletModal}
          walletAddress={walletAddress}
          onDisconnect={handleDisconnect}
        />
      )}
    </>
  );
};

export default Navigation;
