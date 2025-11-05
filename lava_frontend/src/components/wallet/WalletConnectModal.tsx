import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowRight } from "lucide-react";

interface WalletConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (wallet: string) => void;
}

const wallets = [
  {
    name: "MetaMask",
    description: "The leading self-custodial wallet",
    icon: "🦊",
    color: "bg-orange-500",
  },
  {
    name: "Coinbase Wallet",
    description: "The most user-friendly wallet",
    icon: "🔵",
    color: "bg-blue-500",
  },
  {
    name: "WalletConnect",
    description: "A decentralized future",
    icon: "🔗",
    color: "bg-blue-400",
  },
  {
    name: "Fortmatic",
    description: "Don't settle for less",
    icon: "⬛",
    color: "bg-indigo-600",
  },
];

export const WalletConnectModal = ({
  open,
  onOpenChange,
  onConnect,
}: WalletConnectModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card/95 backdrop-blur-xl border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Connect Wallet</DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <p className="text-muted-foreground mb-6">
            Connect with one of our available wallet providers or create a new one.
          </p>
          
          <div className="space-y-3">
            {wallets.map((wallet) => (
              <button
                key={wallet.name}
                onClick={() => {
                  onConnect(wallet.name);
                  onOpenChange(false);
                }}
                className="w-full flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 border border-border/50 hover:border-primary/50 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg ${wallet.color} flex items-center justify-center text-2xl`}>
                    {wallet.icon}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-foreground">{wallet.name}</p>
                    <p className="text-sm text-muted-foreground">{wallet.description}</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
