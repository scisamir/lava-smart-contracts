import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WalletConnectModal } from "./wallet/WalletConnectModal";
import { ConnectedWalletModal } from "./wallet/ConnectedWalletModal";
import { LAVA_LOGO } from "@/lib/images";

const Navigation = () => {
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const handleConnect = (walletName: string) => {
    // Simulate wallet connection
    const mockAddress = "de43a8f5c2b1e9d7a6c3f4e2b8d5a1c9e7f2a6b4d8e5g42";
    setWalletAddress(mockAddress);
    console.log(`Connected to ${walletName}`);
  };

  const handleDisconnect = () => {
    setWalletAddress(null);
    console.log("Wallet disconnected");
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-2xl font-bold">
                <img src={LAVA_LOGO.src} alt="Lava" className="w-8 h-8" />
                <span className="text-foreground">lava</span>
              </div>
            </Link>
            
            <div className="hidden md:flex items-center gap-8">
              <Link href="/stake" className="text-foreground hover:text-primary transition-colors">
                Stake
              </Link>
              <Link href="/earn" className="text-foreground hover:text-primary transition-colors">
                Earn
              </Link>
              <Link href="/validators" className="text-foreground hover:text-primary transition-colors">
                Validators
              </Link>
            </div>

            <Button 
              onClick={() => walletAddress ? setShowWalletModal(true) : setShowConnectModal(true)}
              className="bg-gradient-lava hover:opacity-90 transition-opacity shadow-glow"
            >
              <span className="mr-2">🔗</span> 
              {walletAddress ? truncateAddress(walletAddress) : "Connect Wallet"}
            </Button>
          </div>
        </div>
      </nav>

      <WalletConnectModal
        open={showConnectModal}
        onOpenChange={setShowConnectModal}
        onConnect={handleConnect}
      />

      <ConnectedWalletModal
        open={showWalletModal}
        onOpenChange={setShowWalletModal}
        walletAddress={walletAddress || ""}
        onDisconnect={handleDisconnect}
      />
    </>
  );
};

export default Navigation;
