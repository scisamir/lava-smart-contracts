"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDown, ChevronDown } from "lucide-react";
import { LAVA_LOGO } from "@/lib/images";
import { WalletConnectModal } from "@/components/wallet/WalletConnectModal";
import { ConnectedWalletModal } from "@/components/wallet/ConnectedWalletModal";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";

export const StakingInputCard = () => {
  const { connected, connect, disconnect, walletAddress, balance } =
    useCardanoWallet();

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [amount, setAmount] = useState<string>("0.00");

  const conversionRate = 0.996;
  const usdRate = 0.32;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, "");
    setAmount(value);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (amount === "0.00") setAmount("");
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === "") setAmount("0.00");
  };

  const numAmount = parseFloat(amount) || 0;

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
      console.error("Failed to disconnect:", error);
    }
  };

  const truncateAddress = (address: string) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <>
      <Card className="mx-auto max-w-lg p-6">
        <div className="relative z-[4] space-y-6">
          {/* ADA Input */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[13px] text-dim">Your staking</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setAmount((balance / 2).toFixed(2))}
                  className="h-[26px] rounded-full px-3 font-mono-lava text-[11px] uppercase tracking-[0.02em] text-[#ff9a4d] shadow-[inset_0_0_0_1px_rgba(255,154,77,0.3)] transition-colors hover:bg-[#ff9a4d]/10"
                >
                  Half
                </button>
                <button
                  onClick={() => setAmount(balance.toFixed(2))}
                  className="h-[26px] rounded-full px-3 font-mono-lava text-[11px] uppercase tracking-[0.02em] text-[#ff9a4d] shadow-[inset_0_0_0_1px_rgba(255,154,77,0.3)] transition-colors hover:bg-[#ff9a4d]/10"
                >
                  Max
                </button>
              </div>
            </div>

            <div className="lava-well flex items-center justify-between p-4">
              <button className="flex items-center gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06]">
                  <span className="text-xl">₳</span>
                </div>
                <span className="font-semibold">ADA</span>
                <ChevronDown className="h-4 w-4 text-dim" />
              </button>
              <input
                type="text"
                value={amount}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                inputMode="decimal"
                placeholder="0.00"
                className="tabular w-24 appearance-none bg-transparent text-right text-[26px] font-medium tracking-tightest outline-none"
              />
            </div>
            <p className="tabular mt-1 text-right text-[12px] text-dim">
              ≈ ${(numAmount * usdRate).toFixed(2)}
            </p>
          </div>

          {/* Divider */}
          <div className="flex justify-center">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#12161c] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">
              <ArrowDown className="h-4 w-4 text-dim" />
            </div>
          </div>

          {/* stADA Output */}
          <div>
            <label className="mb-2 block text-[13px] text-dim">
              To receive
            </label>
            <div className="lava-well flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-lava p-2">
                  <img
                    src={LAVA_LOGO.src}
                    alt="stADA"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="font-semibold">stADA</span>
              </div>
              <div className="text-right">
                <p className="tabular text-[26px] font-medium tracking-tightest">
                  {(numAmount / conversionRate).toFixed(2)}
                </p>
                <p className="text-[13px] text-dim">
                  ≈ ${((numAmount / conversionRate) * usdRate).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-1 text-[13px] text-dim">
            <div className="flex justify-between">
              <span>1 stADA</span>
              <span>0.996 ADA ($0.32)</span>
            </div>
            <div className="flex justify-between">
              <span>Balance</span>
              <span>{balance.toFixed(2)} ADA</span>
            </div>
          </div>

          {/* Wallet Button */}
          <Button
            onClick={() =>
              connected ? setShowWalletModal(true) : setShowConnectModal(true)
            }
            className="w-full"
          >
            {connected && walletAddress
              ? truncateAddress(walletAddress)
              : "Connect Wallet"}
          </Button>
        </div>
      </Card>

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
