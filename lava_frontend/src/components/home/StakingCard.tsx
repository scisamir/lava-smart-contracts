"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDown, ChevronDown, Zap, Wallet } from "lucide-react";
import { Slug } from "@/components/layout/Section";
import { TokenIcon } from "@/components/brand/TokenIcon";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";
import { toast } from "react-toastify";
import { MeshFullTxWallet, TOKEN_PAIRS, TokenPair, UserOrderType } from "@/lib/types";
import { fetchBackend } from "@/lib/backendClient";
import { getTransactionExplorerUrl, networkConfig } from "@/lib/networkConfig";
import { resolveTxHash } from "@meshsdk/core";

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
    tokenBalances,
    poolInfo,
    retryWalletAccess,
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

  const selectedUnderlyingPolicyId =
    selectedVault?.tokenDetails?.base?.policyId ?? "";
  const selectedUnderlyingAssetNameHex =
    selectedVault?.tokenDetails?.base?.assetNameHex ?? "";
  const isAdaVault = selectedVault?.tokenPair?.base === "ADA";

  const selectedUnderlyingUnit = (() => {
    if (isAdaVault) {
      return "lovelace";
    }

    return `${selectedUnderlyingPolicyId}${selectedUnderlyingAssetNameHex}`;
  })();
  const hasValidUnderlyingAsset = isAdaVault
    ? !selectedUnderlyingPolicyId && !selectedUnderlyingAssetNameHex
    : Boolean(selectedUnderlyingPolicyId && selectedUnderlyingAssetNameHex);
  const isVaultReady = Boolean(
    selectedVault?.status === "Open" &&
    selectedPoolStakeAssetNameHex &&
    hasValidUnderlyingAsset
  );

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
    setAmount("0.00");
  };

  /* Every side of every pair is directly selectable: picking the base token
     mints, picking the derivative redeems. The swap arrow stays as a shortcut
     for the same state change. */
  type TokenChoice = {
    pair: TokenPair;
    symbol: string;
    counterpart: string;
    isDerivative: boolean;
  };

  const tokenChoices: TokenChoice[] = availableTokenPairs.flatMap((pair) => [
    { pair, symbol: pair.base, counterpart: pair.derivative, isDerivative: false },
    { pair, symbol: pair.derivative, counterpart: pair.base, isDerivative: true },
  ]);

  const handleSelectToken = (choice: TokenChoice) => {
    setSelectedToken(choice.pair);
    setIsSwapped(choice.isDerivative);
    setAmount("0.00");
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

  const handleCreateOptInOrder = async (amount: number, tokenName: string) => {
    if (!isVaultReady) {
      toastFailure("Vault configuration is unavailable. Please try again after backend sync.");
      return;
    }

    try {
      const networkId = await wallet.getNetworkId();
      if (networkId !== networkConfig.networkId) {
        toastFailure(`Use ${networkConfig.label} network`);
        return;
      }
    } catch {
      toastFailure("Unable to verify network. Please try again.");
      return;
    }

    setIsProcessing(true);

    let txHash = "";
    try {
      const { session, walletData } = await retryWalletAccess();

      let currentUtxos = walletData.walletUtxos ?? [];
      try {
        if (typeof (wallet as any).getUtxos === "function") {
          const liveUtxos = await (wallet as any).getUtxos();
          if (Array.isArray(liveUtxos) && liveUtxos.length > 0 && liveUtxos.every((u: any) => u?.output?.amount)) {
            currentUtxos = liveUtxos;
          }
        }
      } catch (utxoErr) {
        console.warn("[StakingCard] wallet.getUtxos fallback:", utxoErr);
      }

      let currentCollateral = walletData.collateral ?? null;
      try {
        if (typeof (wallet as any).getCollateral === "function") {
          const liveCollateral = await (wallet as any).getCollateral();
          if (Array.isArray(liveCollateral) && liveCollateral.length > 0 && liveCollateral[0]?.output?.amount) {
            currentCollateral = liveCollateral[0];
          }
        }
      } catch (colErr) {
        console.warn("[StakingCard] wallet.getCollateral fallback:", colErr);
      }
      if (currentCollateral && currentCollateral.output && !currentCollateral.output.address) {
        currentCollateral.output.address = walletAddress;
      }

      const response = await fetchBackend("/build-user-order-tx", {
        method: "POST",
        token: session.token,
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
          walletCollateral: currentCollateral,
          walletUtxos: currentUtxos,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error || `Failed to build tx: ${response.status}`);
      }

      const data = await response.json();
      const signedTx = await (wallet as unknown as MeshFullTxWallet).signTxReturnFullTx(String(data.unsignedTx), true);
      try {
        txHash = await wallet.submitTx(signedTx);
      } catch (submitErr: any) {
        const errMsg = String(submitErr?.data?.error || submitErr?.message || submitErr);
        if (/already been included|all inputs are spent/i.test(errMsg)) {
          try {
            txHash = resolveTxHash(signedTx);
            console.warn("[StakingCard] Tx already included in mempool, resolved txHash:", txHash);
          } catch (hashErr) {
            console.warn("[StakingCard] Failed to resolveTxHash:", hashErr);
            throw submitErr;
          }
        } else {
          throw submitErr;
        }
      }
      try {
        const orderTime = Date.now();
        const orderAmount = tokenName === "ADA" ? Math.trunc(amount * 1_000_000) : amount;
        const optimisticOrder: UserOrderType = {
          amount: orderAmount,
          txHash,
          outputIndex: 0,
          isOptIn: true,
          tokenName,
          firstSeenAt: orderTime,
        };
        const rawExisting = sessionStorage.getItem("lava_optimistic_orders");
        const existing: UserOrderType[] = rawExisting ? JSON.parse(rawExisting) : [];
        existing.push(optimisticOrder);
        sessionStorage.setItem("lava_optimistic_orders", JSON.stringify(existing));
      } catch {
        // Ignore storage write failures
      }
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
    if (!isVaultReady) {
      toastFailure("Vault configuration is unavailable. Please try again after backend sync.");
      return;
    }

    try {
      const networkId = await wallet.getNetworkId();
      if (networkId !== networkConfig.networkId) {
        toastFailure(`Use ${networkConfig.label} network`);
        return;
      }
    } catch {
      toastFailure("Unable to verify network. Please try again.");
      return;
    }

    setIsProcessing(true);

    const requestAmount = tokenName === "LADA" ? Math.trunc(amount * 1_000_000) : amount;

    let txHash = "";
    try {
      const { session, walletData } = await retryWalletAccess();

      let currentUtxos = walletData.walletUtxos ?? [];
      try {
        if (typeof (wallet as any).getUtxos === "function") {
          const liveUtxos = await (wallet as any).getUtxos();
          if (Array.isArray(liveUtxos) && liveUtxos.length > 0 && liveUtxos.every((u: any) => u?.output?.amount)) {
            currentUtxos = liveUtxos;
          }
        }
      } catch (utxoErr) {
        console.warn("[StakingCard] wallet.getUtxos fallback:", utxoErr);
      }

      let currentCollateral = walletData.collateral ?? null;
      try {
        if (typeof (wallet as any).getCollateral === "function") {
          const liveCollateral = await (wallet as any).getCollateral();
          if (Array.isArray(liveCollateral) && liveCollateral.length > 0 && liveCollateral[0]?.output?.amount) {
            currentCollateral = liveCollateral[0];
          }
        }
      } catch (colErr) {
        console.warn("[StakingCard] wallet.getCollateral fallback:", colErr);
      }
      if (currentCollateral && currentCollateral.output && !currentCollateral.output.address) {
        currentCollateral.output.address = walletAddress;
      }

      const response = await fetchBackend("/build-user-order-tx", {
        method: "POST",
        token: session.token,
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
          walletCollateral: currentCollateral,
          walletUtxos: currentUtxos,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error || `Failed to build tx: ${response.status}`);
      }

      const data = await response.json();
      const signedTx = await (wallet as unknown as MeshFullTxWallet).signTxReturnFullTx(String(data.unsignedTx), true);
      try {
        txHash = await wallet.submitTx(signedTx);
      } catch (submitErr: any) {
        const errMsg = String(submitErr?.data?.error || submitErr?.message || submitErr);
        if (/already been included|all inputs are spent/i.test(errMsg)) {
          try {
            txHash = resolveTxHash(signedTx);
            console.warn("[StakingCard] Tx already included in mempool, resolved txHash:", txHash);
          } catch (hashErr) {
            console.warn("[StakingCard] Failed to resolveTxHash:", hashErr);
            throw submitErr;
          }
        } else {
          throw submitErr;
        }
      }
      try {
        const orderTime = Date.now();
        sessionStorage.setItem(`lava_order_time_${txHash}`, String(orderTime));
        const optimisticOrder: UserOrderType = {
          amount: requestAmount,
          txHash,
          outputIndex: 0,
          isOptIn: false,
          tokenName,
          firstSeenAt: orderTime,
        };
        const rawExisting = sessionStorage.getItem("lava_optimistic_orders");
        const existing: UserOrderType[] = rawExisting ? JSON.parse(rawExisting) : [];
        existing.push(optimisticOrder);
        sessionStorage.setItem("lava_optimistic_orders", JSON.stringify(existing));
      } catch {
        // Ignore storage write failures
      }
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
      setAmount((halfRaw / 1_000_000).toFixed(2));
      return;
    }

    setAmount((displayedTokenBalance / 2).toFixed(2));
  };

  const setMaxAmount = () => {
    if (tokenLabel === "LADA") {
      const rawBalance = Math.trunc(tokenBalance ?? 0);
      setAmount((rawBalance / 1_000_000).toFixed(2));
      return;
    }

    setAmount(displayedTokenBalance.toFixed(2));
  };

  let actionLabel = isSwapped ? "Unstake" : "Stake now";
  if (!isVaultReady) {
    actionLabel = "Vault unavailable";
  } else if (isProcessing) {
    actionLabel = "Processing…";
  }

  return (
    <div
      data-reveal
      className="lava-card lava-card--soft w-full max-w-[520px] p-[22px] sm:p-6"
    >
      <div className="relative z-[4] flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <Slug>{isSwapped ? "/redeem" : "/mint"}</Slug>
          <span className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">
            {isSwapped
              ? `${selectedToken.derivative} → ${selectedToken.base}`
              : `${selectedToken.base} → ${selectedToken.derivative}`}
          </span>
        </div>

        {/* ---- amount in / amount out ---- */}
        <div className="relative flex flex-col gap-1">
          {/* TOP: YOUR STAKING */}
          <div className="lava-well flex flex-col gap-3.5 p-5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-dim">Your staking</span>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={setHalfAmount}
                  className="h-[26px] rounded-full px-3 font-mono-lava text-[11px] uppercase tracking-[0.02em] text-[#ff9a4d] shadow-[inset_0_0_0_1px_rgba(255,154,77,0.3)] transition-colors hover:bg-[#ff9a4d]/10"
                >
                  Half
                </button>
                <button
                  type="button"
                  onClick={setMaxAmount}
                  className="h-[26px] rounded-full px-3 font-mono-lava text-[11px] uppercase tracking-[0.02em] text-[#ff9a4d] shadow-[inset_0_0_0_1px_rgba(255,154,77,0.3)] transition-colors hover:bg-[#ff9a4d]/10"
                >
                  Max
                </button>
              </div>
            </div>

            <div className="flex h-[52px] items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <TokenIcon symbol={isSwapped ? selectedToken.derivative : selectedToken.base} size={38} />
                <button
                  ref={tokenButtonRef}
                  type="button"
                  onClick={() => setIsTokenMenuOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 text-[22px] font-medium tracking-tightest transition-colors hover:text-[#ff9a4d]"
                >
                  {isSwapped ? selectedToken.derivative : selectedToken.base}
                  <ChevronDown
                    className={`h-4 w-4 text-dim transition-transform ${
                      isTokenMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </div>

              <div className="min-w-0 text-right">
                <input
                  value={amount}
                  onChange={handleChange}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  inputMode="decimal"
                  aria-label="Amount"
                  className="tabular w-full max-w-[150px] bg-transparent text-right text-[28px] font-medium tracking-tightest outline-none"
                />
                <div className="tabular text-[12px] text-dim">
                  ≈ ${(numAmount * usdRate).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* SWAP: a round chip straddling the seam between the two wells */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center">
            <button
              type="button"
              onClick={handleSwap}
              aria-label="Swap direction"
              className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-[#141920] text-dim shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] transition-colors hover:text-[#ff9a4d]"
            >
              <ArrowDown
                className={`h-4 w-4 transition-transform duration-300 ${
                  isSwapped ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>

          {/* BOTTOM: TO RECEIVE */}
          <div className="lava-well flex flex-col gap-3.5 p-5">
            <span className="text-[13px] text-dim">To receive</span>

            <div className="flex h-[52px] items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <TokenIcon symbol={isSwapped ? selectedToken.base : selectedToken.derivative} size={38} />
                <span className="text-[22px] font-medium tracking-tightest">
                  {isSwapped ? selectedToken.base : selectedToken.derivative}
                </span>
              </div>

              <div className="min-w-0 text-right">
                <div className="tabular text-[28px] font-medium tracking-tightest">{amount}</div>
                <div className="tabular text-[12px] text-dim">
                  ≈ ${((numAmount / conversionRate) * usdRate).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---- readout ---- */}
        <div className="flex flex-col gap-2 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-dim">1 {selectedToken.derivative}</span>
            <span className="tabular flex items-center gap-2 font-mono-lava text-[13px] text-[#ffd9a8]">
              {conversionRate.toFixed(3)} {selectedToken.base}
              <Zap className="h-3.5 w-3.5 text-dim" />
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-dim">Balance</span>
            <span className="tabular flex items-center gap-2 font-mono-lava text-[13px]">
              {displayedTokenBalance.toFixed(2)} {tokenLabel}
              <Wallet className="h-3.5 w-3.5 text-dim" />
            </span>
          </div>
        </div>

        {/* ---- action ---- */}
        <Button
          variant="default"
          className="w-full"
          disabled={
            !connected ||
            !walletAddress ||
            !walletVK ||
            !isVaultReady ||
            isProcessing ||
            numAmount === 0
          }
          onClick={async () =>
            isSwapped
              ? await handleCreateRedeemOrder(numAmount, selectedToken.derivative)
              : await handleCreateOptInOrder(numAmount, selectedToken.base)
          }
        >
          {actionLabel}
        </Button>
      </div>

      {isTokenMenuOpen && (
        <div
          ref={tokenMenuRef}
          className="lava-panel fixed z-[9999] max-h-[280px] overflow-y-auto p-1.5"
          style={{
            top: tokenMenuStyle.top,
            left: tokenMenuStyle.left,
            width: tokenMenuStyle.width,
            boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          }}
        >
          <div className="relative z-[4]">
            {tokenChoices.map((choice) => {
              const isSelected =
                choice.pair.base === selectedToken.base &&
                choice.pair.derivative === selectedToken.derivative &&
                choice.isDerivative === isSwapped;

              return (
                <button
                  key={`${choice.pair.base}-${choice.pair.derivative}-${choice.symbol}`}
                  type="button"
                  onClick={() => handleSelectToken(choice)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06] ${
                    isSelected ? "bg-white/[0.04]" : ""
                  }`}
                >
                  <TokenIcon symbol={choice.symbol} size={28} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[14px] font-medium tracking-tighter ${
                        isSelected ? "text-[#ff9a4d]" : "text-white"
                      }`}
                    >
                      {choice.symbol}
                    </span>
                    <span className="block font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">
                      {choice.isDerivative ? "Redeem" : "Mint"} &rarr; {choice.counterpart}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
