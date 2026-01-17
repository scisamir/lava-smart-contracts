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
import { MintTestTokens } from "./stake/MinTestTokens";

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
    { label: "Vaults", path: "/vaults" },
    { label: "Portfolio", path: "/portfolio" },
  ];

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 border-b border-border"
        style={{ background: "#0F0F0FCC", backdropFilter: "blur(20px)" }}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-2xl font-bold">
                <img src={LAVA_LOGO.src} alt="Lava" className="w-8 h-8" />
                <span style={{ color: "#D5463E" }}>lava</span>
              </div>
            </Link>

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

            <div className="hidden md:inline-block">
              <MintTestTokens />
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() =>
                  connected
                    ? setShowWalletModal(true)
                    : setShowConnectModal(true)
                }
                className="bg-gradient-lava hover:opacity-90 transition-opacity shadow-glow nav-connect-button"
              >
                <span className="mr-2">🔗</span>
                {connected && walletAddress
                  ? truncateAddress(walletAddress)
                  : "Connect Wallet"}
              </Button>

              {/* Mobile Menu */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden nav-mobile-trigger"
                  >
                    <span className="nav-corner tl" />
                    <span className="nav-corner tr" />
                    <span className="nav-corner bl" />
                    <span className="nav-corner br" />
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>

                <SheetContent
                  side="right"
                  className="
                    w-[280px]
                    border-0
                    flex justify-end
                    bg-[rgba(15,15,15,0.8)]
                    backdrop-blur-[10px]
                  "
                >
                  <div
                    className="
                      mt-8
                      flex flex-col
                      items-end
                      gap-4
                    "
                    style={{ fontFamily: "Pixelify Sans" }}
                  >
                    {navItems.map((item) => (
                      <button
                        key={item.path}
                        onClick={() => {
                          router.push(item.path);
                          setMobileMenuOpen(false);
                        }}
                        className="
                          mobile-nav-item
                          px-3 py-2
                          text-white
                          text-[16px]
                          leading-[100%]
                          tracking-[-0.02em]
                          hover:opacity-80
                          transition-opacity
                        "
                      >
                        {item.label}
                      </button>
                    ))}

                    <div className="pt-2">
                      <MintTestTokens
                        variant="mobile"
                        className={`mobile-nav-item px-3 py-2 text-white text-[16px] leading-[100%] tracking-[-0.02em] hover:opacity-80 transition-opacity w-full text-left px-4 py-3 rounded-lg text-foreground hover:bg-muted transition-colors`}
                      />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>

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
