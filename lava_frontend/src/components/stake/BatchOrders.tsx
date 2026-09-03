import { useState } from "react";
import { Button } from "../ui/button"
import { toast } from "react-toastify";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";
import { fetchBackend } from "@/lib/backendClient";
import { retryWalletAuthSession, type WalletSigner } from "@/lib/walletAuth";
import { getTransactionExplorerUrl } from "@/lib/networkConfig";

export const BatchOrders = ({ totalOrder }: any) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const { wallet, walletAddress } = useCardanoWallet();

  // Toast
  const toastSuccess = (txHash: string) => {
    toast.success(<div>
      Success!  
      <br />
      <a
        href={getTransactionExplorerUrl(txHash)}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "#61dafb", textDecoration: "underline" }}
      >
        View on Explorer
      </a>
    </div>);
  };
  const toastFailure = (err: any) => toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);

  const handleBatching = async (batchType: "test" | "tStrike" | "tPulse") => {
      setIsProcessing(true);

      try {
        const session = await retryWalletAuthSession(
          wallet as WalletSigner,
          walletAddress
        );

        const response = await fetchBackend('/batch-orders', {
          method: "POST",
          token: session.token,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ batchType }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || `Batching failed: ${response.status}`);
        }

        const txHash = data?.txHash;
        if (!txHash) {
          throw new Error("No tx hash returned from backend");
        }

        toastSuccess(txHash);
        console.log("batching tx hash:", txHash);
      } catch (e) {
        setIsProcessing(false);
        toastFailure(e);
        console.error("e tx:", e);
        console.log("Err in handle batching");
        return;
      }

      setIsProcessing(false);
    }

  const BATCHES: { key: "tStrike" | "test" | "tPulse"; label: string }[] = [
    { key: "tStrike", label: "Batch tStrike" },
    { key: "test", label: "Batch Test" },
    { key: "tPulse", label: "Batch tPulse" },
  ];

  return (
    <div className="mt-10 flex w-full flex-col justify-center gap-4 md:flex-row">
      {BATCHES.map((batch) => (
        <Button
          key={batch.key}
          variant="outline"
          disabled={isProcessing}
          onClick={() => handleBatching(batch.key)}
          className="relative"
        >
          {isProcessing ? "Processing…" : batch.label}
          <span className="lava-slug ml-1">{totalOrder[batch.key] ?? 0}</span>
        </Button>
      ))}
    </div>
  );
};
