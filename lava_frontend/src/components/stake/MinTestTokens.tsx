import { useState } from "react";
import { Button } from "../ui/button";
import { toast } from "react-toastify";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";
import { mintTestTokens } from "@/e2e/utils/mintTestTokens";

export const MintTestTokens = ({ variant = "default", className = "" }: { variant?: "default" | "mobile"; className?: string }) => {

  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const {
    txBuilder,
    blockchainProvider,
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
          href={`https://preprod.cardanoscan.io/transaction/${txHash}`}
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
    console.log("txBuilder:", txBuilder);
    console.log("blockchainProvider:", blockchainProvider);

    if (!txBuilder || !blockchainProvider || !walletCollateral) {
      toastFailure("Error: Blockchain provider/txBuilder not initialized");
      setIsProcessing(false);
      return;
    }

    let txHash = "";
    try {
      txHash = await mintTestTokens(
        txBuilder,
        wallet,
        walletAddress,
        walletCollateral,
        walletUtxos
      );
      txBuilder.reset();
    } catch (e) {
      txBuilder.reset();
      setIsProcessing(false);
      toastFailure(e);
      console.error("e tx:", e);
      console.log("Err in handle mint test tokens");
      return;
    }

    blockchainProvider.onTxConfirmed(txHash, async () => {
      txBuilder.reset();
      setIsProcessing(false);
      toastSuccess(txHash);
      await reloadWalletState();
      console.log(`Mint test tokens tx hash:`, txHash);
    });
  };

  const defaultMobileClass = `bg-transparent text-white px-3 py-2 text-[16px] leading-[100%] tracking-[-0.02em] hover:opacity-80 shadow-none`;
  const defaultDesktopClass = `bg-gradient-lava hover:opacity-90 transition-opacity shadow-glow px-2 py-4`;

  const btnClass = className ? className : variant === "mobile" ? defaultMobileClass : defaultDesktopClass;

  return (
    <Button disabled={isProcessing} onClick={handleMintTestTokens} className={btnClass}>
      {isProcessing ? "Processing..." : "Mint Test Tokens"}
    </Button>
  );
};
