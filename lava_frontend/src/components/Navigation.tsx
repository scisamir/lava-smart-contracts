"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Wallet as WalletIcon } from "lucide-react";
import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
// WalletConnectModal replaced by an anchored popover in-navigation
import { ConnectedWalletModal } from "./wallet/ConnectedWalletModal";
import { LAVA_LOGO } from "@/lib/images";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";
import { MintTestTokens } from "./stake/MinTestTokens";

type DetectedWallet = {
  key: string;
  name: string;
  icon?: string;
};

const WalletOptions = ({ onConnect }: { onConnect: (name: string) => void }) => {
  const [availableWallets, setAvailableWallets] = useState<DetectedWallet[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).cardano) {
      const cardano = (window as any).cardano;
      const detected: DetectedWallet[] = Object.keys(cardano)
        .filter((key) => cardano[key].enable)
        .map((key) => ({
          key,
          name: cardano[key].name,
          icon: cardano[key].icon,
        }));
      setAvailableWallets(detected);
    }
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {availableWallets.length === 0 ? (
        <p className="text-muted-foreground text-sm">No Cardano wallets detected.</p>
      ) : (
        availableWallets.map((wallet, idx) => (
          <Button
            key={idx}
            variant="outline"
            className="h-10 justify-start gap-3 hover:bg-muted/50 bg-transparent"
            onClick={() => onConnect(wallet.key)}
          >
            {wallet.icon && <img src={wallet.icon} alt={wallet.name} className="w-5 h-5" />}
            <span className="text-sm font-medium">{wallet.name}</span>
          </Button>
        ))
      )}
    </div>
  );
};

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

  const popoverRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        showConnectModal &&
        popoverRef.current &&
        buttonRef.current &&
        !popoverRef.current.contains(target) &&
        !buttonRef.current.contains(target)
      ) {
        setShowConnectModal(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showConnectModal]);

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
              <div className="relative">
                <button
                  ref={buttonRef}
                  onClick={() => setShowConnectModal((s) => !s)}
                  className="relative flex items-center justify-center w-10 h-10 bg-black border border-gray-600 hover:opacity-90 transition-opacity"
                  style={{ width: 40, height: 40 }}
                >
                  <div className="absolute w-1 h-1 bg-white top-0 left-0"></div>
                  <div className="absolute w-1 h-1 bg-white top-0 right-0"></div>
                  <div className="absolute w-1 h-1 bg-white bottom-0 left-0"></div>
                  <div className="absolute w-1 h-1 bg-white bottom-0 right-0"></div>
                  <WalletIcon className="w-5 h-5" style={{ color: '#666666' }} />
                </button>

                {showConnectModal && (
                  <div
                    ref={popoverRef}
                    className="absolute right-0 mt-2 w-64 bg-card/90 backdrop-blur-lg p-3 rounded-none z-50"
                    style={{ minWidth: 220, boxShadow: 'none' }}
                  >
                    {!connected ? (
                      <WalletOptions onConnect={(name: string) => handleConnect(name)} />
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="text-sm text-white">{truncateAddress(walletAddress ?? "")}</div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              handleDisconnect();
                              setShowConnectModal(false);
                            }}
                            className="w-full justify-start"
                          >
                            Disconnect
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Mobile Menu */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="md:hidden relative flex items-center justify-center w-10 h-10 bg-black border border-white/13 hover:opacity-90 transition-opacity"
                    style={{ width: 40, height: 40 }}
                  >
                    <div className="absolute w-1 h-1 bg-white top-0 left-0"></div>
                    <div className="absolute w-1 h-1 bg-white top-0 right-0"></div>
                    <div className="absolute w-1 h-1 bg-white bottom-0 left-0"></div>
                    <div className="absolute w-1 h-1 bg-white bottom-0 right-0"></div>
                    <div className="absolute flex flex-col gap-[3px]" style={{ left: '12.39px', top: '12.85px' }}>
                      <div className="bg-gray-400" style={{ width: '15.22px', height: '2.77px' }}></div>
                      <div className="bg-gray-400" style={{ width: '15.22px', height: '2.77px' }}></div>
                      <div className="bg-gray-400" style={{ width: '15.22px', height: '2.77px' }}></div>
                    </div>
                  </button>
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

      {/* WalletConnectModal replaced by anchored popover in the nav */}

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
