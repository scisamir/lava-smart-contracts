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
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>My wallet</DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <button
            onClick={() => {
              onDisconnect();
              onOpenChange(false);
            }}
            className="lava-well group flex w-full items-center justify-between p-4 transition-colors hover:bg-white/[0.06]"
          >
            <div className="text-left">
              <p className="mb-1 text-[15px] font-medium tracking-tighter">Disconnect</p>
              <p className="font-mono-lava text-[12px] text-dim">
                {truncateAddress(walletAddress)}
              </p>
            </div>
            <LogOut className="h-4 w-4 text-dim transition-colors group-hover:text-[#df473d]" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
