"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { LAVA_LOGO } from "@/lib/images";
import { useCardanoWallet } from "@/hooks/useCardanoWallet"; // ✅ Import your hook

export const StakingCard = () => {
  const { connected, walletAddress } = useCardanoWallet();

  return (
    <Card className="max-w-lg mx-auto p-6 bg-card/80 backdrop-blur-lg border-border shadow-glow-md">
      <div className="space-y-6">
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
            <div className="text-right">
              <p className="text-2xl font-bold">0.00</p>
              <p className="text-muted-foreground text-sm">≈ $0.00</p>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
            <ArrowDown className="w-6 h-6 text-primary" />
          </div>
        </div>

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
              <p className="text-2xl font-bold">0.00</p>
              <p className="text-muted-foreground text-sm">≈ $0.00</p>
            </div>
          </div>
        </div>

        <div className="text-sm text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>1 stADA</span>
            <span>0.996 ADA ($0.32)</span>
          </div>
          <div className="flex justify-between">
            <span>Balance</span>
            <span>0 ADA</span>
          </div>
        </div>

        <Button
          className="w-full bg-gradient-lava hover:opacity-90 transition-opacity shadow-glow text-lg py-6"
          disabled={connected}
        >
          {connected && walletAddress
            ? `Connected: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
            : "Connect Wallet in Nav"}
        </Button>
      </div>
    </Card>
  );
};
