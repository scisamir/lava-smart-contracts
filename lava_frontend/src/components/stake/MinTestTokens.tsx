import { useState } from "react";
import { Button } from "../ui/button";
import { toast } from "react-toastify";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";
import { fetchBackend } from "@/lib/backendClient";
import { getTransactionExplorerUrl, networkConfig } from "@/lib/networkConfig";
import { MeshFullTxWallet } from "@/lib/types";

export const MintTestTokens = ({ variant = "default", className = "" }: { variant?: "default" | "mobile"; className?: string }) => {

  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const {
    connected,
    wallet,
    walletAddress,
    retryWalletAccess,
    reloadWalletState,
  } = useCardanoWallet();

  // Toast
  const toastSuccess = (txHash: string) => {
    toast.success(
      <div>
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
      if (networkId !== networkConfig.networkId) {
        toastFailure(`Use ${networkConfig.label} network`);
        setIsProcessing(false);
        return;
      }
    } catch (err) {
      toastFailure("Unable to verify network. Please try again.");
      setIsProcessing(false);
      return;
    }

    let txHash = "";
    try {
      const { session, walletData } = await retryWalletAccess();
      const walletCollateral = walletData.collateral ?? null;

      if (!walletCollateral) {
        throw new Error("Missing wallet collateral");
      }

      const response = await fetchBackend('/build-mint-test-tokens-tx', {
        method: "POST",
        token: session.token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          walletCollateral,
          walletUtxos: walletData.walletUtxos ?? [],
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to build mint tx: ${response.status}`);
      }

      const data = await response.json();
      const signedTx = await (wallet as unknown as MeshFullTxWallet).signTxReturnFullTx(String(data.unsignedTx), true);
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

  return (
    <Button
      variant={variant === "mobile" ? "ghost" : "outline"}
      size="sm"
      disabled={!connected || !walletAddress || isProcessing}
      onClick={handleMintTestTokens}
      className={variant === "mobile" ? `w-full justify-start ${className}` : className}
    >
      {isProcessing ? "Processing..." : "Mint Test Tokens"}
    </Button>
  );
};
