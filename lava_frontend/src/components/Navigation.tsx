"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { WalletConnectModal } from "./wallet/WalletConnectModal";
import { ConnectedWalletModal } from "./wallet/ConnectedWalletModal";
import { LAVA_LOGO } from "@/lib/images";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";

const Navigation = () => {
  const router = useRouter();
  const { connected, connect, disconnect, walletAddress } = useCardanoWallet();

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleConnect = async (walletName: string) => {
    try {
      await connect(walletName);
      setShowConnectModal(false);
    } catch (error) {
      console.error("Wallet connection failed:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setShowWalletModal(false);
    } catch (error) {
      console.error("Disconnect failed:", error);
    }
  };

  const truncateAddress = (address: string) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`;

  const navItems = [
    { label: "Stake", path: "/stake" },
    { label: "Earn", path: "/earn" },
    { label: "Validators", path: "/validators" },
    { label: "Portfolio", path: "/portfolio" }, // ✅ this is the new page
  ];

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

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className="text-foreground hover:text-primary transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Right Side Buttons */}
            <div className="flex items-center gap-2">
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

              {/* Mobile Menu */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-[280px] bg-background border-border"
                >
                  <div className="flex flex-col gap-2 mt-8">
                    {navItems.map((item) => (
                      <button
                        key={item.path}
                        onClick={() => {
                          router.push(item.path);
                          setMobileMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 rounded-lg text-foreground hover:bg-muted transition-colors"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
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
