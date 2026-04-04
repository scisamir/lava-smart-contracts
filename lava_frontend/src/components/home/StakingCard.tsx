"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDown, ChevronDown, Zap, Wallet } from "lucide-react";
import { LAVA_LOGO, STRIKETOKENS_LOGO, SPLASH_LOGO, FLUIDTOKENS_LOGO } from "@/lib/images";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";
import { toast } from "react-toastify";
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
  const DEFAULT_TOKEN_PAIR: TokenPair = TOKEN_PAIRS[0] ?? {
    base: "ADA",
    derivative: "LADA",
  };

  const [amount, setAmount] = useState<string>("0.00");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSwapped, setIsSwapped] = useState<boolean>(false);
  const [selectedToken, setSelectedToken] = useState<TokenPair>(DEFAULT_TOKEN_PAIR);
  const [isTokenMenuOpen, setIsTokenMenuOpen] = useState<boolean>(false);
  const [tokenMenuStyle, setTokenMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
  }>({ top: 0, left: 0, width: 220 });
  const tokenButtonRef = useRef<HTMLButtonElement | null>(null);
  const tokenMenuRef = useRef<HTMLDivElement | null>(null);

  const {
    connected,
    wallet,
    walletAddress,
    walletVK,
    walletSK,
    walletUtxos,
    tokenBalances,
    poolInfo,
    refreshWalletStateAfterTx,
  } = useCardanoWallet();

  const availableTokenPairs: TokenPair[] = (() => {
    const fromVaults = (poolInfo ?? [])
      .map((vault) => ({
        base: String(vault?.tokenPair?.base ?? ""),
        derivative: String(vault?.tokenPair?.derivative ?? ""),
      }))
      .filter((pair) => pair.base.length > 0 && pair.derivative.length > 0);

    const source = fromVaults.length > 0 ? fromVaults : TOKEN_PAIRS;
    const uniquePairs: TokenPair[] = [];

    source.forEach((pair) => {
      const exists = uniquePairs.some(
        (p) => p.base === pair.base && p.derivative === pair.derivative
      );
      if (!exists) {
        uniquePairs.push(pair);
      }
    });

    return uniquePairs;
  })();

  const selectedVault = (poolInfo ?? []).find(
    (vault) =>
      vault?.tokenPair?.base === selectedToken.base &&
      vault?.tokenPair?.derivative === selectedToken.derivative
  );

  const selectedPoolStakeAssetNameHex =
    selectedVault?.poolStakeAssetNameHex ||
    selectedVault?.tokenDetails?.derivative?.assetNameHex ||
    "";

  const selectedUnderlyingUnit = (() => {
    const policyId = selectedVault?.tokenDetails?.base?.policyId ?? "";
    const assetNameHex = selectedVault?.tokenDetails?.base?.assetNameHex ?? "";
    if (!policyId && !assetNameHex) {
      return "lovelace";
    }
    return `${policyId}${assetNameHex}`;
  })();

  useEffect(() => {
    const selectedStillExists = availableTokenPairs.some(
      (pair) =>
        pair.base === selectedToken.base &&
        pair.derivative === selectedToken.derivative
    );

    if (!selectedStillExists && availableTokenPairs.length > 0) {
      setSelectedToken(availableTokenPairs[0]);
    }
  }, [availableTokenPairs, selectedToken.base, selectedToken.derivative]);

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

  const handleSelectTokenPair = (pair: TokenPair) => {
    setSelectedToken(pair);
    setIsTokenMenuOpen(false);
  };

  useEffect(() => {
    if (!isTokenMenuOpen) {
      return;
    }

    const updateMenuPosition = () => {
      const rect = tokenButtonRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      setTokenMenuStyle({
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(220, rect.width + 40),
      });
    };

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        tokenButtonRef.current?.contains(target) ||
        tokenMenuRef.current?.contains(target)
      ) {
        return;
      }

      setIsTokenMenuOpen(false);
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isTokenMenuOpen]);

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

  const handleCreateOptInOrder = async (amount: number, tokenName: string) => {
    setIsProcessing(true);

    let txHash = "";
    try {
      const backendBaseUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/lava-vaults\/?$/, "") ||
        "https://0lth59w8rl.execute-api.us-east-1.amazonaws.com/prod";

      const response = await fetch(`${backendBaseUrl}/build-user-order-tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "opt-in",
          amount,
          tokenName,
          poolStakeAssetName: selectedPoolStakeAssetNameHex,
          underlyingUnit: selectedUnderlyingUnit,
          walletAddress,
          walletVK,
          walletSK,
          walletUtxos,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error || `Failed to build tx: ${response.status}`);
      }

      const data = await response.json();
      const signedTx = await wallet.signTx(String(data.unsignedTx), true);
      txHash = await wallet.submitTx(signedTx);
    } catch (e) {
      setIsProcessing(false);
      toastFailure(e);
      console.error("e tx:", e);
      console.log("Err in handle create opt in order");
      return;
    }

    setIsProcessing(false);
    toastSuccess(txHash);
    await refreshWalletStateAfterTx();
    window.dispatchEvent(new CustomEvent("lava:refresh-home-data"));
    console.log("Create opt in order tx hash:", txHash);
  };

  const handleCreateRedeemOrder = async (amount: number, tokenName: string) => {
    setIsProcessing(true);

    const requestAmount = tokenName === "LADA" ? Math.trunc(amount * 1_000_000) : amount;

    let txHash = "";
    try {
      const backendBaseUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/lava-vaults\/?$/, "") ||
        "https://0lth59w8rl.execute-api.us-east-1.amazonaws.com/prod";

      const response = await fetch(`${backendBaseUrl}/build-user-order-tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "redeem",
          amount: requestAmount,
          tokenName,
          poolStakeAssetName: selectedPoolStakeAssetNameHex,
          underlyingUnit: selectedUnderlyingUnit,
          walletAddress,
          walletVK,
          walletSK,
          walletUtxos,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error || `Failed to build tx: ${response.status}`);
      }

      const data = await response.json();
      const signedTx = await wallet.signTx(String(data.unsignedTx), true);
      txHash = await wallet.submitTx(signedTx);
    } catch (e) {
      setIsProcessing(false);
      toastFailure(e);
      console.error("e tx:", e);
      console.log("Err in handle create redeem order");
      return;
    }

    setIsProcessing(false);
    toastSuccess(txHash);
    await refreshWalletStateAfterTx();
    window.dispatchEvent(new CustomEvent("lava:refresh-home-data"));
    console.log("Create redeem order tx hash:", txHash);
  };

  // helper for which token balance to use
  const tokenBalance = isSwapped
    ? tokenBalances[selectedToken.derivative]
    : tokenBalances[selectedToken.base];
  const tokenLabel = isSwapped ? selectedToken.derivative : selectedToken.base;
  const displayedTokenBalance =
    tokenLabel === "LADA" ? (tokenBalance ?? 0) / 1_000_000 : tokenBalance ?? 0;

  const setHalfAmount = () => {
    if (tokenLabel === "LADA") {
      const rawBalance = Math.trunc(tokenBalance ?? 0);
      const halfRaw = Math.trunc(rawBalance / 2);
      setAmount((halfRaw / 1_000_000).toFixed(6));
      return;
    }

    setAmount((displayedTokenBalance / 2).toFixed(2));
  };

  const setMaxAmount = () => {
    if (tokenLabel === "LADA") {
      const rawBalance = Math.trunc(tokenBalance ?? 0);
      setAmount((rawBalance / 1_000_000).toFixed(6));
      return;
    }

    setAmount(displayedTokenBalance.toFixed(2));
  };

  return (
  <Card className="w-full max-w-[520px] h-[436px] bg-[#0D0D0D] p-6 flex flex-col gap-6 relative rounded-none">
    {/* MAIN INPUT / OUTPUT */}
    <div className="w-full h-[236px] relative flex flex-col">

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
              onClick={setHalfAmount}
              className="w-[40px] h-[24px] border border-[#D5463E80] text-[#D5463E] text-[12px] font-medium bg-white/[0.02] staking-half-btn"
            >
              Half
            </button>

            <button
              onClick={setMaxAmount}
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
                tStrike: STRIKETOKENS_LOGO?.src,
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

            <div>
              <button
                ref={tokenButtonRef}
                type="button"
                onClick={() => setIsTokenMenuOpen((prev) => !prev)}
                className="text-[24px] font-medium text-white flex items-center gap-2"
              >
                {isSwapped ? selectedToken.derivative : selectedToken.base}
                <ChevronDown
                  className={`w-5 h-5 text-[#D5463E] transition-transform ${
                    isTokenMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="text-right">
            <input
              value={amount}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              className="bg-transparent text-[32px] font-medium text-white w-24 sm:w-[130px] max-w-full text-right outline-none no-pixelify"
            />
            <div className="text-[14px] text-white/80">
              ≈ ${(numAmount * usdRate).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute left-0 right-0 flex items-center justify-center z-40 pointer-events-none"
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
          <button
            type="button"
            onClick={handleSwap}
            className="staking-arrow-btn w-full h-full flex items-center justify-center"
            aria-label="Swap tokens"
          >
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
                tStrike: STRIKETOKENS_LOGO?.src,
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
          <span>{displayedTokenBalance.toFixed(2)} {tokenLabel}</span>
          <Wallet className="w-4 h-4 text-[#666666]" style={{ color: '#666666' }} />
        </span>
      </div>
    </div>

    {/* corner clusters */}
    <Cluster left={0.31} top={-0.25} rotate={0} />
    <Cluster right={0.31} top={-0.25} rotate={-270} />
    <Cluster left={0.31} bottom={-0.25} rotate={-90} />
    <Cluster right={0.31} bottom={-0.25} rotate={180} />

    {isTokenMenuOpen && (
      <div
        ref={tokenMenuRef}
        className="fixed max-h-[220px] overflow-y-auto bg-[#111111] border border-[#2A2A2A] shadow-2xl z-[9999]"
        style={{
          top: tokenMenuStyle.top,
          left: tokenMenuStyle.left,
          width: tokenMenuStyle.width,
        }}
      >
        {availableTokenPairs.map((pair) => {
          const pairLabel = isSwapped
            ? `${pair.derivative} / ${pair.base}`
            : `${pair.base} / ${pair.derivative}`;
          const isSelected =
            pair.base === selectedToken.base &&
            pair.derivative === selectedToken.derivative;

          return (
            <button
              key={`${pair.base}-${pair.derivative}`}
              type="button"
              onClick={() => handleSelectTokenPair(pair)}
              className={`w-full px-3 py-2 text-left text-sm border-b border-[#1F1F1F] last:border-b-0 hover:bg-[#1B1B1B] ${
                isSelected ? "text-[#D5463E]" : "text-white"
              }`}
            >
              {pairLabel}
            </button>
          );
        })}
      </div>
    )}

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
      <span
        className="relative z-10 staking-action-text"
        style={{
          fontFamily: "Pixelify Sans, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
          fontWeight: 500,
          fontSize: "16px",
          lineHeight: "100%",
          letterSpacing: "-0.04em",
          textTransform: "uppercase",
        }}
      >
        {isProcessing ? "Processing..." : isSwapped ? "Unstake" : "Stake Now"}
      </span>

      {/* Corner pixels — 4 corners */}
      <span style={{ position: "absolute", width: 4, height: 4, right: 0, top: 0, background: "#FFFFFF", zIndex: 2 }} />
      <span style={{ position: "absolute", width: 4, height: 4, left: 0, top: 0, background: "#FFFFFF", zIndex: 2 }} />
      <span style={{ position: "absolute", width: 4, height: 4, right: 0, bottom: 0, background: "#FFFFFF", zIndex: 2 }} />
      <span style={{ position: "absolute", width: 4, height: 4, left: 0, bottom: 0, background: "#FFFFFF", zIndex: 2 }} />
    </Button>
  </Card>
);



};
