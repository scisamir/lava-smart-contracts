"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Wallet as WalletIcon, Menu, LogOut } from "lucide-react";
import { useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ConnectedWalletModal } from "./wallet/ConnectedWalletModal";
import { LavaWordmark } from "./brand/LadaMark";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";
import { networkConfig } from "@/lib/networkConfig";
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
    <div className="flex flex-col gap-1">
      {availableWallets.length === 0 ? (
        <p className="px-2 py-3 text-sm text-dim">No Cardano wallets detected.</p>
      ) : (
        availableWallets.map((wallet) => (
          <button
            key={wallet.key}
            type="button"
            onClick={() => onConnect(wallet.key)}
            className="flex h-11 items-center gap-3 rounded-xl px-3 text-left transition-colors hover:bg-white/[0.06]"
          >
            {wallet.icon && <img src={wallet.icon} alt="" className="h-5 w-5 rounded" />}
            <span className="text-sm font-medium">{wallet.name}</span>
          </button>
        ))
      )}
    </div>
  );
};

const NAV_ITEMS = [
  { label: "Stake", path: "/stake" },
  { label: "Earn", path: "/earn" },
  { label: "Portfolio", path: "/portfolio" },
  { label: "Points", path: "/points" },
];

const Navigation = () => {
  const router = useRouter();
  const pathname = router.pathname;
  const { connected, connect, disconnect, walletAddress } = useCardanoWallet();
  const showMintTestTokens = networkConfig.name === "preprod";

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

  return (
    <>
      <nav
        className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.07]"
        style={{ background: "rgba(5, 7, 10, 0.72)", backdropFilter: "blur(20px)" }}
      >
        <div className="shell">
          <div className="flex h-[68px] items-center justify-between gap-6">
            <Link href="/" aria-label="Lava home" className="shrink-0">
              <LavaWordmark
                markClassName="h-[20px] w-[20px] text-lava-ember"
                textClassName="text-[20px] font-semibold tracking-tightest"
              />
            </Link>

            <div className="hidden items-center gap-8 md:flex">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`text-[14px] tracking-tighter transition-colors ${
                      isActive ? "text-white" : "text-dim hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              {showMintTestTokens && (
                <div className="hidden md:inline-flex">
                  <MintTestTokens />
                </div>
              )}

              <div className="relative">
                <button
                  ref={buttonRef}
                  onClick={() => setShowConnectModal((s) => !s)}
                  className={`lava-pill lava-pill--sm ${connected ? "lava-pill--ghost" : ""}`}
                >
                  <WalletIcon className="h-4 w-4" />
                  <span className="hidden sm:inline font-mono-lava text-[12px] tracking-normal">
                    {connected && walletAddress ? truncateAddress(walletAddress) : "Connect"}
                  </span>
                </button>

                {showConnectModal && (
                  <div
                    ref={popoverRef}
                    className="lava-panel absolute right-0 z-50 mt-3 w-64 p-2"
                    style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}
                  >
                    <div className="relative z-[4]">
                      {!connected ? (
                        <>
                          <p className="px-3 pb-1 pt-2 font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">
                            Connect a wallet
                          </p>
                          <WalletOptions onConnect={handleConnect} />
                        </>
                      ) : (
                        <div className="flex flex-col gap-2 p-1">
                          <div className="rounded-xl bg-white/[0.04] px-3 py-2">
                            <p className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">
                              Connected
                            </p>
                            <p className="font-mono-lava text-[13px]">
                              {truncateAddress(walletAddress ?? "")}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              handleDisconnect();
                              setShowConnectModal(false);
                            }}
                            className="flex h-10 items-center justify-between rounded-xl px-3 text-sm transition-colors hover:bg-white/[0.06]"
                          >
                            Disconnect
                            <LogOut className="h-4 w-4 text-dim" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile menu */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <button
                    className="lava-pill lava-pill--sm lava-pill--ghost md:hidden"
                    style={{ width: 36, paddingInline: 0 }}
                    aria-label="Open menu"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                </SheetTrigger>

                <SheetContent
                  side="right"
                  className="w-[280px] border-0 border-l border-white/[0.07] p-6"
                  style={{ background: "rgba(5, 7, 10, 0.92)", backdropFilter: "blur(20px)" }}
                >
                  <div className="mt-10 flex flex-col gap-1">
                    {NAV_ITEMS.map((item) => (
                      <button
                        key={item.path}
                        onClick={() => {
                          router.push(item.path);
                          setMobileMenuOpen(false);
                        }}
                        className={`rounded-xl px-3 py-3 text-left text-[16px] tracking-tighter transition-colors hover:bg-white/[0.06] ${
                          pathname === item.path ? "text-white" : "text-dim"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}

                    {showMintTestTokens && (
                      <div className="mt-4">
                        <MintTestTokens variant="mobile" />
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>

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
