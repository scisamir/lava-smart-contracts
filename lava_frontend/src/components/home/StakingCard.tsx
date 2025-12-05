"use client";

import { use, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { LAVA_LOGO } from "@/lib/images";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";
import { toast, ToastContainer } from 'react-toastify';
import { createOptInOrder } from "@/e2e/order/create_opt_in_order";
import { createRedeemOrder } from "@/e2e/order/create_redeem_order";

export const StakingCard = () => {
  const [amount, setAmount] = useState<string>("0.00");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSwapped, setIsSwapped] = useState<boolean>(false);

  const { connected, txBuilder, blockchainProvider, walletCollateral, wallet, walletAddress, walletVK, walletSK, walletUtxos } = useCardanoWallet();

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

  const handleCreateOptInOrder = async (amount: number) => {
    setIsProcessing(true);
    console.log("txBuilder:", txBuilder);
    console.log("walletCollateral:", walletCollateral);
    console.log("blockchainProvider:", blockchainProvider);

    if (!txBuilder || !walletCollateral || !blockchainProvider) {
      toastFailure("Error: Check collateral")
      return;
    }

    let txHash = "";
    try {
      txHash = await createOptInOrder(
        txBuilder,
        wallet,
        walletAddress,
        walletCollateral,
        walletUtxos,
        walletVK,
        walletSK,
        amount,
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

  const handleCreateRedeemOrder = async (amount: number) => {
    setIsProcessing(true);
    console.log("txBuilder:", txBuilder);
    console.log("walletCollateral:", walletCollateral);
    console.log("blockchainProvider:", blockchainProvider);

    if (!txBuilder || !walletCollateral || !blockchainProvider) {
      toastFailure("Error: Check collateral")
      return;
    }

    let txHash = "";
    try {
      txHash = await createRedeemOrder(
        txBuilder,
        wallet,
        walletAddress,
        walletCollateral,
        walletUtxos,
        walletVK,
        walletSK,
        amount,
      );
      txBuilder.reset();
    } catch (e) {
      txBuilder.reset();
      setIsProcessing(false);
      toastFailure(e);
      console.error("e tx:", e);
      console.log("Err in handle create order");
      return;
    }

    blockchainProvider.onTxConfirmed(txHash, () => {
      txBuilder.reset();
      setIsProcessing(false);
      toastSuccess(txHash);
      console.log("Create order tx hash:", txHash);
    });
  }

  return (
    <Card className="max-w-lg mx-auto p-6 bg-card/80 backdrop-blur-lg border-border shadow-glow-md">
      <div className="space-y-6">
        {/* ADA input */}
        <div>
          <label className="text-muted-foreground text-sm mb-2 block">
            Your staking
          </label>
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                {isSwapped ?
                  <img
                    src={LAVA_LOGO.src}
                    alt="stADA"
                    className="w-full h-full object-contain"
                  /> :
                  <span className="text-xl">t</span>
                }
                {/* <span className="text-xl">₳</span> */}
              </div>
              <span className="font-semibold">{isSwapped ? "stTest" : "test"}</span>
              {/* <span className="font-semibold">ADA</span> */}
            </div>
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
          </div>
          <p className="text-right text-sm text-muted-foreground mt-1">
            ≈ $1
            {/* ≈ ${(numAmount * usdRate).toFixed(2)} */}
          </p>
        </div>

        {/* Divider */}
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center" onClick={handleSwap}>
            <ArrowDown className={`w-6 h-6 text-primary transition-transform duration-300 ${isSwapped ? "rotate-180" : ""}`}  />
          </div>
        </div>

        {/* stADA output */}
        <div>
          <label className="text-muted-foreground text-sm mb-2 block">
            To receive
          </label>
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-lava flex items-center justify-center shadow-glow p-2">
                {isSwapped ?
                  <span className="text-xl">t</span> :
                  <img
                    src={LAVA_LOGO.src}
                    alt="stADA"
                    className="w-full h-full object-contain"
                  />
                }
              </div>
              <span className="font-semibold">{isSwapped ? "test" : "stTest"}</span>
              {/* <span className="font-semibold">stADA</span> */}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">
                {amount}
                {/* {(numAmount / conversionRate || 0).toFixed(2)} */}
              </p>
              <p className="text-muted-foreground text-sm">
                ≈ $1
                {/* ≈ ${((numAmount / conversionRate) * usdRate).toFixed(2)} */}
              </p>
            </div>
          </div>
        </div>

        {/* Wallet button */}
        <Button
          className="w-full bg-gradient-lava hover:opacity-90 transition-opacity shadow-glow text-lg py-6"
          disabled={!connected || isProcessing || numAmount === 0}
          onClick={async () => isSwapped ?
            await handleCreateRedeemOrder(numAmount) :
            await handleCreateOptInOrder(numAmount)
          }
        >
          {isProcessing
            ? "Processing..."
            : isSwapped ? "Unstake" : "Stake"
          }
        </Button>
      </div>
    </Card>
  );
};
