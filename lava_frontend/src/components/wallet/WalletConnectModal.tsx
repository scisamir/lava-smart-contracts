"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect a wallet</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-4">
          {availableWallets.length === 0 ? (
            <p className="text-sm text-dim">
              No Cardano wallets detected. Please install Nami, Lace, or Eternl.
            </p>
          ) : (
            availableWallets.map((wallet, index) => (
              <button
                key={index}
                type="button"
                className="lava-well flex h-14 items-center gap-3 px-4 text-left transition-colors hover:bg-white/[0.07]"
                onClick={() => onConnect(wallet.key)}
              >
                {wallet.icon && (
                  <img src={wallet.icon} alt="" className="h-6 w-6 rounded" />
                )}
                <span className="text-[15px] font-medium tracking-tighter">{wallet.name}</span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
