import { useState } from "react";
import { Button } from "../ui/button"
import { toast } from "react-toastify";

export const BatchOrders = ({ totalOrder }: any) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Toast
  const toastSuccess = (txHash: string) => {
    toast.success(<div>
      Success!  
      <br />
      <a
        href={`https://cardanoscan.io/transaction/${txHash}`} 
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
        const backendBaseUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/lava-vaults\/?$/, "") ||
          "https://0lth59w8rl.execute-api.us-east-1.amazonaws.com/prod";

        const response = await fetch(`${backendBaseUrl}/batch-orders`, {
          method: "POST",
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

  return (
    <div className="w-full flex flex-col md:flex-row justify-center mt-10 gap-10">
      <Button
        disabled={isProcessing}
        onClick={() => handleBatching("tStrike")}
        className="relative bg-gradient-lava hover:opacity-90 transition-opacity shadow-glow text-xl px-5 py-7 btn-lava"
      >
        <span className="absolute top-0 right-0 px-1 text-sm text-red-600 bg-white border border-r-2">GTO: {totalOrder.tStrike ?? 0}</span>
        {isProcessing ? "Processing..." : "Batch tStrike"}
      </Button>
      <Button
        disabled={isProcessing}
        onClick={() => handleBatching("test")}
        className="relative bg-gradient-lava hover:opacity-90 transition-opacity shadow-glow text-xl px-5 py-7 btn-lava"
      >
        <span className="absolute top-0 right-0 px-1 text-sm text-red-600 bg-white border border-r-2">GTO: {totalOrder.test ?? 0}</span>
        {isProcessing ? "Processing..." : "Batch Test"}
      </Button>
      <Button
        disabled={isProcessing}
        onClick={() => handleBatching("tPulse")}
        className="relative bg-gradient-lava hover:opacity-90 transition-opacity shadow-glow text-xl px-5 py-7 btn-lava"
      >
        <span className="absolute top-0 right-0 px-1 text-sm text-red-600 bg-white border border-r-2">GTO: {totalOrder.tPulse ?? 0}</span>
        {isProcessing ? "Processing..." : "Batch tPulse"}
      </Button>
    </div>
  )
}
