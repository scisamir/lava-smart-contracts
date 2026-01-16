"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDown, ChevronDown, Zap, Wallet } from "lucide-react";
import { LAVA_LOGO, STRIKEFINANCE_LOGO, SPLASH_LOGO, FLUIDTOKENS_LOGO } from "@/lib/images";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";
import { toast } from "react-toastify";
import { createOptInOrder } from "@/e2e/order/create_opt_in_order";
import { createRedeemOrder } from "@/e2e/order/create_redeem_order";
import { TOKEN_PAIRS, TokenPair } from "@/lib/types";

// PixelCorner removed — unused decorative element

const Cluster = ({ left, right, top, bottom, rotate = 0 }: { left?: number; right?: number; top?: number; bottom?: number; rotate?: number }) => {
  const containerStyle: any = {
    position: "absolute",
    width: 36.05,
    height: 36.05,
    transform: `rotate(${rotate}deg)`,
    zIndex: 5,
  };
  if (left !== undefined) containerStyle.left = left;
  if (right !== undefined) containerStyle.right = right;
  if (top !== undefined) containerStyle.top = top;
  if (bottom !== undefined) containerStyle.bottom = bottom;

  return (
    <div style={containerStyle}>
      <div style={{ position: "absolute", width: 12.02, height: 12.02, left: 12.33, top: 11.77, background: "#1B1B1B" }} />
      <div style={{ position: "absolute", width: 12.02, height: 12.02, left: 0.31, top: -0.25, background: "#1B1B1B" }} />
      <div style={{ position: "absolute", width: 12.02, height: 12.02, left: 24.34, top: 11.77, background: "#1B1B1B" }} />
      <div style={{ position: "absolute", width: 12.02, height: 12.02, left: 12.33, top: 23.79, background: "#1B1B1B" }} />
    </div>
  );
};

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
  <Card className="w-[520px] h-[436px] bg-[#0D0D0D] p-6 flex flex-col gap-6 relative rounded-none">
    {/* MAIN INPUT / OUTPUT */}
    <div className="w-[472px] h-[236px] relative flex flex-col">

      {/* pixel corners removed (no visual effect) */}

      {/* EDGE DECORATIONS */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-[#2A2A2A]" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-[#2A2A2A]" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-[#2A2A2A]" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-[#2A2A2A]" />
      </div>

      {/* TOP: YOUR STAKING */}
      <div className="w-full h-[115px] bg-black p-4 flex flex-col gap-3 relative z-20">
        <div className="flex justify-between items-center">
          <span className="text-[14px] text-white/70">Your staking</span>

          <div className="flex gap-1 staking-half-box">
            <button
              onClick={() => setAmount(((tokenBalance ?? 0) / 2).toFixed(2))}
              className="w-[40px] h-[24px] border border-[#D5463E80] text-[#D5463E] text-[12px] font-medium bg-white/[0.02] staking-half-btn"
            >
              Half
            </button>

            <button
              onClick={() => setAmount((tokenBalance ?? 0).toFixed(2))}
              className="w-[41px] h-[24px] border border-[#D5463E80] text-[#D5463E] text-[12px] font-medium bg-white/[0.02] staking-max-btn"
            >
              Max
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center h-[48px]">
          <div className="flex items-center gap-2">
            {/* Render token icon directly (no boxed wrapper). Use placeholder when not available. */}
            {(() => {
              const name = isSwapped ? selectedToken.derivative : selectedToken.base;
              const map: Record<string, string | undefined> = {
                tStrike: STRIKEFINANCE_LOGO?.src,
                tPulse: SPLASH_LOGO?.src,
                test: FLUIDTOKENS_LOGO?.src,
              };
              const imgSrc = map[name] ?? LAVA_LOGO?.src;
              return imgSrc ? (
                <img src={imgSrc} alt={name} className="w-[40px] h-[40px] object-contain" />
              ) : (
                <span className="text-xl">{name?.charAt(0) ?? "T"}</span>
              );
            })()}

            <span className="text-[24px] font-medium text-white flex items-center gap-2">
              {isSwapped ? selectedToken.derivative : selectedToken.base}
              <ChevronDown className="w-5 h-5 text-[#D5463E]" />
            </span>
          </div>

          <div className="text-right">
            <input
              value={amount}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              className="bg-transparent text-[32px] font-medium text-white w-[130px] text-right outline-none no-pixelify"
            />
            <div className="text-[14px] text-white/80">
              ≈ ${(numAmount * usdRate).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* ───────────── DIVIDER (6px) ───────────── */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center z-40"
        style={{ top: "112px", height: "6px" }}
      >
        <div className="flex-1 h-[2px] bg-[#2A2A2A]" />
        <div className="w-[30px]" />
        <div className="flex-1 h-[2px] bg-[#2A2A2A] z-40" />
      </div>

      {/* CENTER ARROW (CUTS THROUGH DIVIDER) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-30"
        style={{ top: "100px" }}
      >
        <div className="w-[30px] h-[30px] bg-[#000000] border-[2px] border-[#2A2A2A] flex items-center justify-center staking-arrow">
          <button onClick={handleSwap} className="staking-arrow-btn">
            <ArrowDown
              className={`w-5 h-5 text-[#303030] transition-transform ${
                isSwapped ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* BOTTOM: TO RECEIVE (NO GAP) */}
      <div className="w-full h-[115px] bg-black p-4 flex flex-col gap-3 relative z-20">
        <span className="text-[14px] text-white/70">To receive</span>

        <div className="flex justify-between items-center h-[55px]">
          <div className="flex items-center gap-2">
            {(() => {
              const name = isSwapped ? selectedToken.base : selectedToken.derivative;
              const map: Record<string, string | undefined> = {
                tStrike: STRIKEFINANCE_LOGO?.src,
                tPulse: SPLASH_LOGO?.src,
                test: FLUIDTOKENS_LOGO?.src,
              };
              const imgSrc = map[name] ?? LAVA_LOGO?.src;
              return imgSrc ? (
                <img src={imgSrc} alt={name} className="w-[40px] h-[40px] object-contain" />
              ) : (
                <span className="text-[24px] font-medium text-white">{name}</span>
              );
            })()}
            <span className="text-[24px] font-medium text-white">
              {isSwapped ? selectedToken.base : selectedToken.derivative}
            </span>
          </div>

          <div className="text-right">
            <div className="text-[28px] font-medium text-white no-pixelify">
              {amount}
            </div>
            <div className="text-[14px] text-white/80 no-pixelify">
              ≈ ${((numAmount / conversionRate) * usdRate).toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* INFO */}
    <div className="w-full flex flex-col gap-2 text-[14px] text-white">
      <div className="flex justify-between items-center">
        <span className="flex items-center gap-2">
          1 {selectedToken.derivative}
        </span>
          <span className="flex items-center gap-2">
          <span>0.996 {selectedToken.base} ($0.32)</span>
          <Zap className="w-4 h-4 text-[#666666]" style={{ color: '#666666' }} />
        </span>
      </div>

      <div className="flex justify-between items-center">
        <span className="flex items-center gap-2">
          Balance
        </span>
        <span className="no-pixelify flex items-center gap-2">
          <span>{(tokenBalance ?? 0).toFixed(2)} {tokenLabel}</span>
          <Wallet className="w-4 h-4 text-[#666666]" style={{ color: '#666666' }} />
        </span>
      </div>
    </div>

    {/* corner clusters */}
    <Cluster left={0.31} top={-0.25} rotate={0} />
    <Cluster right={0.31} top={-0.25} rotate={-270} />
    <Cluster left={0.31} bottom={-0.25} rotate={-90} />
    <Cluster right={0.31} bottom={-0.25} rotate={180} />

    {/* ACTION BUTTON */}
    <Button
      disabled={!connected || isProcessing || numAmount === 0}
      onClick={async () =>
        isSwapped
          ? await handleCreateRedeemOrder(numAmount, selectedToken.derivative)
          : await handleCreateOptInOrder(numAmount, selectedToken.base)
      }
      className="w-full h-[40px] bg-[#D5463E] text-black font-pixel text-[16px] uppercase tracking-tight relative rounded-none z-20"
      style={{ marginTop: "22px" }}
    >
      {isProcessing ? "Processing..." : isSwapped ? "Unstake" : "Stake Now"}
    </Button>
  </Card>
);



};
