"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { LAVA_LOGO } from "@/lib/images";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";
import { toast } from "react-toastify";
import { createOptInOrder } from "@/e2e/order/create_opt_in_order";
import { createRedeemOrder } from "@/e2e/order/create_redeem_order";
import { TOKEN_PAIRS, TokenPair } from "@/lib/types";

export const StakingCard = () => {
  const [amount, setAmount] = useState<string>("0.00");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSwapped, setIsSwapped] = useState<boolean>(false);
  const [selectedToken, setSelectedToken] = useState<TokenPair>(TOKEN_PAIRS[1]);

  const {
    connected,
    txBuilder,
    blockchainProvider,
    wallet,
    walletAddress,
    walletVK,
    walletSK,
    walletUtxos,
    tokenBalances,
  } = useCardanoWallet();

  const conversionRate = 0.996;
  const usdRate = 0.32;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, "");
    setAmount(value);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (amount === "0.00") setAmount("");
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === "") setAmount("0.00");
  };

  const numAmount = parseFloat(amount) || 0;

  const handleSwap = () => {
    setIsSwapped((prev) => !prev);
  };

  useEffect(() => {
    if (isProcessing === true) setAmount("0.00");
  }, [isProcessing]);

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

  const handleCreateOptInOrder = async (amount: number, tokenName: string) => {
    setIsProcessing(true);
    console.log("txBuilder:", txBuilder);
    console.log("blockchainProvider:", blockchainProvider);

    if (!txBuilder || !blockchainProvider) {
      toastFailure("Error: Blockchain not initialized!");
      setIsProcessing(false);
      return;
    }

    let txHash = "";
    try {
      txHash = await createOptInOrder(
        txBuilder,
        wallet,
        walletAddress,
        walletUtxos,
        walletVK,
        walletSK,
        amount,
        tokenName
      );
      txBuilder.reset();
    } catch (e) {
      txBuilder.reset();
      setIsProcessing(false);
      toastFailure(e);
      console.error("e tx:", e);
      console.log("Err in handle create opt in order");
      return;
    }

    blockchainProvider.onTxConfirmed(txHash, () => {
      txBuilder.reset();
      setIsProcessing(false);
      toastSuccess(txHash);
      console.log("Create opt in order tx hash:", txHash);
    });
  };

  const handleCreateRedeemOrder = async (amount: number, tokenName: string) => {
    setIsProcessing(true);
    console.log("txBuilder:", txBuilder);
    console.log("blockchainProvider:", blockchainProvider);

    if (!txBuilder || !blockchainProvider) {
      toastFailure("Error: Blockchain not initialized!");
      setIsProcessing(false);
      return;
    }

    let txHash = "";
    try {
      txHash = await createRedeemOrder(
        txBuilder,
        wallet,
        walletAddress,
        walletUtxos,
        walletVK,
        walletSK,
        amount,
        tokenName
      );
      txBuilder.reset();
    } catch (e) {
      txBuilder.reset();
      setIsProcessing(false);
      toastFailure(e);
      console.error("e tx:", e);
      console.log("Err in handle create redeem order");
      return;
    }

    blockchainProvider.onTxConfirmed(txHash, () => {
      txBuilder.reset();
      setIsProcessing(false);
      toastSuccess(txHash);
      console.log("Create redeem order tx hash:", txHash);
    });
  };

  // helper for which token balance to use
  const tokenBalance = isSwapped
    ? tokenBalances[selectedToken.derivative]
    : tokenBalances[selectedToken.base];
  const tokenLabel = isSwapped ? selectedToken.derivative : selectedToken.base;

  return (
    <Card className="max-w-lg mx-auto p-6 bg-card/80 backdrop-blur-lg border-border shadow-glow-md">
      {/* Combined token input / output container */}
      <div
        className="relative rounded-lg overflow-hidden"
        style={{ backgroundColor: "#0B0B0B", height: "258px" }}
      >
        {/* Top half */}
        <div className="absolute top-0 left-0 right-0 h-[127px]">
          <div className="flex flex-col h-full p-4">
            {/* Row 1: label + buttons */}
            <div className="flex items-center justify-between mb-2">
              <label className="text-muted-foreground text-xs">
                Your staking
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setAmount(((tokenBalance ?? 0) / 2).toFixed(2))
                  }
                  className="text-xs px-2 py-1 border border-primary/50 rounded text-primary"
                >
                  Half
                </button>
                <button
                  onClick={() => setAmount((tokenBalance ?? 0).toFixed(2))}
                  className="text-xs px-2 py-1 border border-primary/50 rounded text-primary"
                >
                  Max
                </button>
              </div>
            </div>

            {/* Row 2: token + amount */}
            <div className="flex items-center justify-between flex-1">
              {/* Token */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-lava flex items-center justify-center">
                  {isSwapped ? (
                    <img
                      src={LAVA_LOGO.src}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-2xl">t</span>
                  )}
                </div>

                {/* Fake dropdown */}
                <div className="relative">
                  <span className="font-semibold text-lg cursor-pointer flex items-center gap-1">
                    {isSwapped ? selectedToken.derivative : selectedToken.base}
                    <svg
                      className="w-4 h-4 opacity-70"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </span>

                  <select
                    value={selectedToken.base}
                    onChange={(e) => {
                      const token = TOKEN_PAIRS.find(
                        (t) => t.base === e.target.value
                      );
                      if (token) setSelectedToken(token);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  >
                    {TOKEN_PAIRS.map((t) => (
                      <option
                        key={t.base}
                        value={t.base}
                        className="text-black"
                      >
                        {t.base}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount */}
              <div className="flex flex-col items-end">
                <input
                  value={amount}
                  onChange={handleChange}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  className="bg-transparent text-right text-2xl font-bold w-24 outline-none no-pixelify"
                />
                <p className="text-xs text-muted-foreground">
                  ≈ ${(numAmount * usdRate).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div
          className="absolute left-0 right-0 flex items-center justify-center"
          style={{ top: "127px", height: "4px" }}
        >
          <div style={{ flex: 1, height: "2px", backgroundColor: "#333" }} />
          <div style={{ width: "30px" }} />
          <div style={{ flex: 1, height: "2px", backgroundColor: "#333" }} />
        </div>

        {/* Bottom half */}
        <div className="absolute bottom-0 left-0 right-0 h-[127px]">
          <div className="flex flex-col h-full p-4">
            <label className="text-muted-foreground text-xs mb-2">
              To receive
            </label>

            <div className="flex items-center justify-between flex-1">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-lava flex items-center justify-center">
                  {isSwapped ? (
                    <span className="text-2xl">t</span>
                  ) : (
                    <img
                      src={LAVA_LOGO.src}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>

                <span className="font-semibold text-lg">
                  {isSwapped ? selectedToken.base : selectedToken.derivative}
                </span>
              </div>

              <div className="flex flex-col items-end">
                <p className="text-2xl font-bold no-pixelify">{amount}</p>
                <p className="text-xs text-muted-foreground no-pixelify">
                  ≈ ${((numAmount / conversionRate) * usdRate).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div
          className="absolute left-1/2 transform -translate-x-1/2 z-20"
          style={{ top: "107px" }}
        >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "0px",
                backgroundColor: "#0B0B0B",
                border: "3px solid #333",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
            <button
              onClick={handleSwap}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-transparent"
            >
              <ArrowDown
                className={`w-6 h-6 text-primary transition-transform duration-300 ${
                  isSwapped ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="text-sm text-muted-foreground space-y-1">
        <div className="flex justify-between">
          <span>1 {selectedToken.derivative}</span>
          <span>1 {selectedToken.base} ($1.00)</span>
        </div>
        <div className="flex justify-between">
          <span>Balance</span>
          <span className="no-pixelify">
            {(tokenBalance ?? 0).toFixed(2)} {tokenLabel}
          </span>
        </div>
      </div>

      {/* Wallet button */}
      <Button
        className="w-full hover:opacity-90 transition-opacity shadow-glow text-lg py-6 text-white"
        style={{
          background:
            "linear-gradient(181.52deg, #FFD13F -26.73%, #F41B00 98.71%)",
        }}
        disabled={!connected || isProcessing || numAmount === 0}
        onClick={async () =>
          isSwapped
            ? await handleCreateRedeemOrder(numAmount, selectedToken.derivative)
            : await handleCreateOptInOrder(numAmount, selectedToken.base)
        }
      >
        {isProcessing ? "Processing..." : isSwapped ? "Unstake" : "Stake Now"}
      </Button>
    </Card>
  );
};
