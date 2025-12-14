import { useState } from "react";
import { Button } from "../ui/button"
import { batchingTx } from "@/e2e/batching/batching";
import { toast } from "react-toastify";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";
import { OrderListProps } from "@/lib/types";
import { batchingTxTest } from "@/e2e/batching/batchingTest";
import { batchingTxStrike } from "@/e2e/batching/batchingStrike";
import { batchingTxPulse } from "@/e2e/batching/batchingPulse";

export const BatchOrders = ({ totalOrder }: any) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  const { txBuilder, blockchainProvider } = useCardanoWallet();

  // Toast
  const toastSuccess = (txHash: string) => {
    toast.success(<div>
      Success!  
      <br />
      <a
        href={`https://preprod.cardanoscan.io/transaction/${txHash}`} 
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
      console.log("txBuilder:", txBuilder);
      console.log("blockchainProvider:", blockchainProvider);

      if (!txBuilder || !blockchainProvider) {
        toastFailure("Error: Check collateral");
        setIsProcessing(false);
        return;
      }

      let txHash = "";
      try {
        txHash = batchType === "test" ? await batchingTxTest(
          blockchainProvider,
          txBuilder,
        ) : batchType === "tStrike" ?
          await batchingTxStrike(
            blockchainProvider,
            txBuilder,
          ) : batchType === "tPulse" ?
          await batchingTxPulse(
            blockchainProvider,
            txBuilder,
          ) : "";

        txBuilder.reset();
      } catch (e) {
        txBuilder.reset();
        setIsProcessing(false);
        toastFailure(e);
        console.error("e tx:", e);
        console.log("Err in handle batching");
        return;
      }
  
      blockchainProvider.onTxConfirmed(txHash, () => {
        txBuilder.reset();
        setIsProcessing(false);
        toastSuccess(txHash);
        console.log("batching tx hash:", txHash);
      });
    }

  return (
    <div className="w-full flex flex-col md:flex-row justify-center mt-10 gap-10">
      <Button
        disabled={isProcessing}
        onClick={() => handleBatching("tStrike")}
        className="relative bg-gradient-lava hover:opacity-90 transition-opacity shadow-glow text-xl px-5 py-7"
      >
        <span className="absolute top-0 right-0 px-1 text-sm text-red-600 bg-white border border-r-2">GTO: {totalOrder.tStrike ?? 0}</span>
        {isProcessing ? "Processing..." : "Batch tStrike"}
      </Button>
      <Button
        disabled={isProcessing}
        onClick={() => handleBatching("test")}
        className="relative bg-gradient-lava hover:opacity-90 transition-opacity shadow-glow text-xl px-5 py-7"
      >
        <span className="absolute top-0 right-0 px-1 text-sm text-red-600 bg-white border border-r-2">GTO: {totalOrder.test ?? 0}</span>
        {isProcessing ? "Processing..." : "Batch Test"}
      </Button>
      <Button
        disabled={isProcessing}
        onClick={() => handleBatching("tPulse")}
        className="relative bg-gradient-lava hover:opacity-90 transition-opacity shadow-glow text-xl px-5 py-7"
      >
        <span className="absolute top-0 right-0 px-1 text-sm text-red-600 bg-white border border-r-2">GTO: {totalOrder.tPulse ?? 0}</span>
        {isProcessing ? "Processing..." : "Batch tPulse"}
      </Button>
    </div>
  )
}
