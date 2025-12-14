"use client";

import { use, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { LAVA_LOGO } from "@/lib/images";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";
import { toast } from 'react-toastify';
import { createOptInOrder } from "@/e2e/order/create_opt_in_order";
import { createRedeemOrder } from "@/e2e/order/create_redeem_order";
import { TOKEN_PAIRS, TokenPair } from "@/lib/types";

export const StakingCard = () => {
  const [amount, setAmount] = useState<string>("0.00");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSwapped, setIsSwapped] = useState<boolean>(false);
  const [selectedToken, setSelectedToken] = useState<TokenPair>(TOKEN_PAIRS[1]);

  const { connected, txBuilder, blockchainProvider, wallet, walletAddress, walletVK, walletSK, walletUtxos, balance } = useCardanoWallet();

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
    setIsSwapped(prev => !prev);
  }

  useEffect(() => {
    if (isProcessing === true) setAmount("0.00")
  }, [isProcessing])

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
        tokenName,
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
  }

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
        tokenName,
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
  }

  return (
    <Card className="max-w-lg mx-auto p-6 bg-card/80 backdrop-blur-lg border-border shadow-glow-md">
      {/* Combined ADA input / stADA output container */}
        <div className="relative rounded-lg overflow-hidden" style={{ backgroundColor: "#0B0B0B", height: "258px" }}>
          {/* Top half: ADA input */}
          <div className="absolute top-0 left-0 right-0" style={{ height: "127px" }}>
            <div className="flex flex-col h-full p-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-muted-foreground text-xs">Your staking</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAmount(((balance ?? 0) / 2).toFixed(2))}
                    className="text-xs px-2 py-1 border border-primary/50 rounded text-primary hover:bg-primary/10"
                  >
                    Half
                  </button>
                  <button
                    onClick={() => setAmount((balance ?? 0).toFixed(2))}
                    className="text-xs px-2 py-1 border border-primary/50 rounded text-primary hover:bg-primary/10"
                  >
                    Max
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between flex-1">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-lava flex items-center justify-center shadow-glow p-2 flex-shrink-0">
                    {isSwapped ?
                      <img
                        src={LAVA_LOGO.src}
                        alt="stADA"
                        className="w-full h-full object-contain"
                      /> :
                      <span className="text-2xl">t</span>
                    }
                  </div>
                  <div className="relative">
                    {/* Fake dropdown (what user sees) */}
                    <span className="font-semibold text-lg cursor-pointer flex items-center gap-1">
                      {isSwapped ? selectedToken.derivative : selectedToken.base}
                      <svg
                        className="w-4 h-4 opacity-70"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>

                    {/* Real select (hidden but clickable) */}
                    <select
                      value={selectedToken.base}
                      onChange={(e) => {
                        const token = TOKEN_PAIRS.find(t => t.base === e.target.value);
                        if (token) setSelectedToken(token);
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    >
                      {TOKEN_PAIRS.map(token => (
                        <option key={token.base} value={token.base} className="text-black">
                          {token.base}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <input
                    type="text"
                    value={amount}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="bg-transparent text-right text-2xl font-bold outline-none w-24 appearance-none"
                  />
                  <p className="text-right text-sm text-muted-foreground mt-1">
                    ≈ ${(numAmount * usdRate).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Horizontal dividing line with gap for arrow */}
          <div className="absolute left-0 right-0 flex items-center justify-center" style={{ top: "127px", height: "4px" }}>
            {/* Left line segment */}
            <div style={{ flex: 1, height: "2px", backgroundColor: "#333" }} />
            {/* Gap for arrow (space in middle) */}
            <div style={{ width: "60px" }} />
            {/* Right line segment */}
            <div style={{ flex: 1, height: "2px", backgroundColor: "#333" }} />
          </div>

          {/* Bottom half: stADA output */}
          <div className="absolute bottom-0 left-0 right-0" style={{ height: "127px" }}>
            <div className="flex flex-col h-full p-4">
              <label className="text-muted-foreground text-xs mb-1 block">
                To receive
              </label>
              <div className="flex items-center justify-between flex-1">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-lava flex items-center justify-center shadow-glow p-2 flex-shrink-0">
                    {isSwapped ?
                      <span className="text-2xl">t</span> :
                      <img
                        src={LAVA_LOGO.src}
                        alt="stADA"
                        className="w-full h-full object-contain"
                      />
                    }
                  </div>
                  <span className="font-semibold text-lg">
                    {isSwapped ? selectedToken.base : selectedToken.derivative}
                  </span>
                  {/* <span className="font-semibold text-lg">{isSwapped ? "test" : "stTest"}</span> */}
                </div>
                <div className="flex flex-col items-end">
                  <p className="text-2xl font-bold">
                    {amount}
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">
                    ≈ ${((numAmount / conversionRate) * usdRate).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Arrow divider centered on the line */}
          <div className="absolute left-1/2 transform -translate-x-1/2 z-20" style={{ top: "99px" }}>
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "9999px",
                backgroundColor: "#0B0B0B",
                border: "3px solid #333",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <button onClick={handleSwap} className="w-12 h-12 rounded-full flex items-center justify-center bg-transparent">
                <ArrowDown className={`w-6 h-6 text-primary transition-transform duration-300 ${isSwapped ? "rotate-180" : ""}`}  />
              </button>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="text-sm text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>1 stADA</span>
            <span>0.996 ADA ($0.32)</span>
          </div>
          <div className="flex justify-between">
            <span>Balance</span>
            <span>{balance?.toFixed(2)} ADA</span>
          </div>
        </div>

        {/* Wallet button */}
        <Button
          className="w-full hover:opacity-90 transition-opacity shadow-glow text-lg py-6 text-white"
          style={{ background: 'linear-gradient(181.52deg, #FFD13F -26.73%, #F41B00 98.71%)' }}
          disabled={!connected || isProcessing || numAmount === 0}
          onClick={async () => isSwapped ?
            await handleCreateRedeemOrder(numAmount, selectedToken.derivative) :
            await handleCreateOptInOrder(numAmount, selectedToken.base)
          }
        >
          {isProcessing
            ? "Processing..."
            : isSwapped ? "Unstake" : "Stake Now"
          }
      </Button>
    </Card>
  );
};
