"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";

type DetectedWallet = {
  key: string;
  name: string;
  icon?: string;
}

export const WalletConnectModal = ({
  open,
  onOpenChange,
  onConnect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (name: string) => void;
}) => {
  const { connect } = useCardanoWallet();
  const [availableWallets, setAvailableWallets] = useState<DetectedWallet[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).cardano) {
      const cardano = (window as any).cardano;
      const detected: DetectedWallet[] = Object.keys(cardano)
        .filter(key => cardano[key].enable)
        .map(key => ({
          key,
          name: cardano[key].name,
          icon: cardano[key].icon,
        }));
        setAvailableWallets(detected);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/90 backdrop-blur-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Connect a Wallet</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-4">
          {availableWallets.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No Cardano wallets detected. Please install Nami, Lace, or Eternl.
            </p>
          ) : (
            availableWallets.map((wallet, index) => (
              <Button
                key={index}
                variant="outline"
                className="h-12 justify-start gap-3 hover:bg-muted/50 bg-transparent"
                onClick={async () => {
                  // Handle wallet connection
                  onConnect(wallet.key)
                }}
              >
                {wallet.icon && (
                  <img src={wallet.icon} alt={wallet.name} className="w-6 h-6" />
                )}
                <span className="text-sm font-medium">{wallet.name}</span>
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
