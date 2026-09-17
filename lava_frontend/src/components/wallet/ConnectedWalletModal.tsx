import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LogOut } from "lucide-react";

interface ConnectedWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: string;
  onDisconnect: () => void;
}

export const ConnectedWalletModal = ({
  open,
  onOpenChange,
  walletAddress,
  onDisconnect,
}: ConnectedWalletModalProps) => {
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-card/95 backdrop-blur-xl border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">My Wallet</DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <button
            onClick={() => {
              onDisconnect();
              onOpenChange(false);
            }}
            className="w-full flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 border border-border/50 hover:border-destructive/50 transition-all group"
          >
            <div className="text-left">
              <p className="font-semibold text-foreground mb-1">Disconnect</p>
              <p className="text-sm text-muted-foreground font-mono">
                {truncateAddress(walletAddress)}
              </p>
            </div>
            <LogOut className="w-5 h-5 text-primary group-hover:text-destructive transition-colors" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
