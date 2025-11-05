import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDown, ChevronDown } from "lucide-react";
import { LAVA_LOGO } from "@/lib/images";

export const StakingInputCard = () => {
  return (
    <Card className="max-w-lg mx-auto p-6 bg-card/80 backdrop-blur-lg border-border shadow-glow-md">
      <div className="space-y-6">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-muted-foreground text-sm">Your staking</label>
            <div className="flex gap-2">
              <button className="text-xs px-2 py-1 border border-primary/50 rounded text-primary hover:bg-primary/10 transition-colors">
                Half
              </button>
              <button className="text-xs px-2 py-1 border border-primary/50 rounded text-primary hover:bg-primary/10 transition-colors">
                Max
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
            <button className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xl">₳</span>
              </div>
              <span className="font-semibold">ADA</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
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
          <label className="text-muted-foreground text-sm mb-2 block">To receive</label>
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-lava flex items-center justify-center shadow-glow p-2">
                <img src={LAVA_LOGO.src} alt="stADA" className="w-full h-full object-contain" />
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
            <span>1stADA</span>
            <span>0.996 ADA ($0.32) 📋</span>
          </div>
          <div className="flex justify-between">
            <span>Balance</span>
            <span>0 ADA 📋</span>
          </div>
        </div>

        <Button className="w-full bg-gradient-lava hover:opacity-90 transition-opacity shadow-glow text-lg py-6">
          Connect Wallet
        </Button>
      </div>
    </Card>
  );
};
