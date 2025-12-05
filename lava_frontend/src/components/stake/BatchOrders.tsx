import { useState } from "react";
import { Button } from "../ui/button"
import { batchingTx } from "@/e2e/batching/batching";
import { toast } from "react-toastify";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";

export const BatchOrders = () => {
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

  const handleBatching = async () => {
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
        txHash = await batchingTx(
          blockchainProvider,
          txBuilder,
        );
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
    <div className="w-full flex justify-center mt-5">
      {/* Toast */}
      {/* <ToastContainer position='top-right' autoClose={5000} /> */}

      <Button
        disabled={isProcessing}
        onClick={() => handleBatching()}
        className="bg-gradient-lava hover:opacity-90 transition-opacity shadow-glow text-xl px-5 py-7"
      >
        {isProcessing ? "Processing..." : "Batch Orders"}
      </Button>
    </div>
  )
}
