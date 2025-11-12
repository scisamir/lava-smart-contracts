"use client";

import { useWalletList } from "@meshsdk/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const WalletConnectModal = ({
  open,
  onOpenChange,
  onConnect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (name: string) => void;
}) => {
  const wallets = useWalletList(); // lists only wallets installed in the browser

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/90 backdrop-blur-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Connect a Wallet</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-4">
          {wallets.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No Cardano wallets detected. Please install Nami, Lace, or Eternl.
            </p>
          ) : (
            wallets.map((wallet) => (
              <Button
                key={wallet.name}
                onClick={() => onConnect(wallet.name)}
                variant="outline"
                className="flex items-center justify-between"
              >
                <span>{wallet.name}</span>
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
