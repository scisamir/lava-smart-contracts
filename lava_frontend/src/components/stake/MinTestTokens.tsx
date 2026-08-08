import { useState } from "react";
import { Button } from "../ui/button";
import { toast } from "react-toastify";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";

export const MintTestTokens = ({ variant = "default", className = "" }: { variant?: "default" | "mobile"; className?: string }) => {

  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const {
    wallet,
    walletAddress,
    walletCollateral,
    walletUtxos,
    reloadWalletState,
  } = useCardanoWallet();

  // Toast
  const toastSuccess = (txHash: string) => {
    toast.success(
      <div>
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
      </div>
    );
  };
  const toastFailure = (err: any) =>
    toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);

  const handleMintTestTokens = async () => {
    setIsProcessing(true);

    // New: Check network ID first to prevent generic errors
    try {
      const networkId = await wallet.getNetworkId();
      if (networkId !== 1) {
        toastFailure("Use mainnet network");
        setIsProcessing(false);
        return;
      }
    } catch (err) {
      toastFailure("Unable to verify network. Please try again.");
      setIsProcessing(false);
      return;
    }

    if (!walletCollateral) {
      toastFailure("Error: Missing wallet collateral");
      setIsProcessing(false);
      return;
    }

    let txHash = "";
    try {
      const backendBaseUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/lava-vaults\/?$/, "") ||
        "https://xk00c9isg3.execute-api.us-east-1.amazonaws.com/prod";

      const response = await fetch(`${backendBaseUrl}/build-mint-test-tokens-tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          walletCollateral,
          walletUtxos,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to build mint tx: ${response.status}`);
      }

      const data = await response.json();
      const signedTx = await wallet.signTx(String(data.unsignedTx), true);
      txHash = await wallet.submitTx(signedTx);
    } catch (e) {
      setIsProcessing(false);
      toastFailure(e);
      console.error("e tx:", e);
      console.log("Err in handle mint test tokens");
      return;
    }

    setIsProcessing(false);
    toastSuccess(txHash);
    await reloadWalletState();
    console.log(`Mint test tokens tx hash:`, txHash);
  };

  const defaultMobileClass = `bg-transparent text-white px-3 py-2 text-[16px] leading-[100%] tracking-[-0.02em] hover:opacity-80 shadow-none`;
  const defaultDesktopClass = `bg-gradient-lava hover:opacity-90 transition-opacity shadow-glow px-2 py-4`;

  const btnClass = className ? className : variant === "mobile" ? defaultMobileClass : defaultDesktopClass;

  return (
    <Button disabled={isProcessing} onClick={handleMintTestTokens} className={`${btnClass} ${variant === "mobile" ? "" : "btn-lava"}`}>
      {isProcessing ? "Processing..." : "Mint Test Tokens"}
    </Button>
  );
};
