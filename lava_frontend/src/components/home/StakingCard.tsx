"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { LAVA_LOGO } from "@/lib/images";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";

export const StakingCard = () => {
  const { connected, walletAddress } = useCardanoWallet();
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

  return (
    <Card className="max-w-lg mx-auto p-6 bg-card/80 backdrop-blur-lg border-border shadow-glow-md">
      <div className="space-y-6">
        {/* ADA input */}
        <div>
          <label className="text-muted-foreground text-sm mb-2 block">
            Your staking
          </label>
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xl">₳</span>
              </div>
              <span className="font-semibold">ADA</span>
            </div>
            <input
              type="text"
              value={amount}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              inputMode="decimal"
              placeholder="0.00"
              className="bg-transparent text-right text-2xl font-bold outline-none w-24 appearance-none"
            />
          </div>
          <p className="text-right text-sm text-muted-foreground mt-1">
            ≈ ${(numAmount * usdRate).toFixed(2)}
          </p>
        </div>

        {/* Divider */}
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
            <ArrowDown className="w-6 h-6 text-primary" />
          </div>
        </div>

        {/* stADA output */}
        <div>
          <label className="text-muted-foreground text-sm mb-2 block">
            To receive
          </label>
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-lava flex items-center justify-center shadow-glow p-2">
                <img
                  src={LAVA_LOGO.src}
                  alt="stADA"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="font-semibold">stADA</span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">
                {(numAmount / conversionRate || 0).toFixed(2)}
              </p>
              <p className="text-muted-foreground text-sm">
                ≈ ${((numAmount / conversionRate) * usdRate).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Wallet button */}
        <Button
          className="w-full bg-gradient-lava hover:opacity-90 transition-opacity shadow-glow text-lg py-6"
          disabled={!connected}
        >
          {connected && walletAddress
            ? `Connected: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
            : "Connect Wallet in Nav"}
        </Button>
      </div>
    </Card>
  );
};
