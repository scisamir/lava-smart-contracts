"use client";

import { Button } from "@/components/ui/button";
import { Slug } from "@/components/layout/Section";
import { XCircle } from "lucide-react";
import { toast } from "react-toastify";
import { MeshFullTxWallet, OrderListProps, UserOrderType } from "@/lib/types";
import { TokenIcon } from "@/components/brand/TokenIcon";
import { useEffect, useState } from "react";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";
import { fetchBackend } from "@/lib/backendClient";
import { getTransactionExplorerUrl } from "@/lib/networkConfig";

export const OrderList = ({ orders }: OrderListProps) => {
  const [pendingCancelKeys, setPendingCancelKeys] = useState<Record<string, true>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittingOrderKey, setSubmittingOrderKey] = useState<string>("");
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const {
    connected,
    wallet,
    walletAddress,
    walletVK,
    retryWalletAccess,
    refreshWalletStateAfterTx,
  } = useCardanoWallet();

  useEffect(() => {
    if (Object.keys(pendingCancelKeys).length === 0) {
      return;
    }

    const liveOrderKeys = new Set(
      orders.map((order) => `${order.txHash}-${order.outputIndex ?? 0}`)
    );

    setPendingCancelKeys((previous) => {
      const next = { ...previous };
      let changed = false;

      Object.keys(next).forEach((key) => {
        if (!liveOrderKeys.has(key)) {
          delete next[key];
          changed = true;
        }
      });

      return changed ? next : previous;
    });
  }, [orders, pendingCancelKeys]);

  const getOptimisticOrders = (): UserOrderType[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = sessionStorage.getItem("lava_optimistic_orders");
      if (!raw) return [];
      const parsed = JSON.parse(raw) as UserOrderType[];
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      return parsed.filter((o) => (o.firstSeenAt ?? 0) > tenMinutesAgo);
    } catch {
      return [];
    }
  };

  const optimisticOrders = getOptimisticOrders();
  const serverTxHashes = new Set(orders.map((o) => o.txHash));
  const pendingOptimistic = optimisticOrders.filter(
    (o) => !serverTxHashes.has(o.txHash) && !pendingCancelKeys[`${o.txHash}-${o.outputIndex ?? 0}`]
  );
  const displayOrders = [...pendingOptimistic, ...orders];

  const formatOrderAmount = (order: UserOrderType) => {
    const token = String(order.tokenName ?? "").toUpperCase();
    if (token === "ADA" || token === "LADA") {
      return (order.amount / 1_000_000).toFixed(2);
    }

    return order.amount.toFixed(2);
  };

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

  const handleCancelOrder = async (order: UserOrderType) => {
    const orderOutputIndex = order.outputIndex ?? 0;
    const orderKey = `${order.txHash}-${orderOutputIndex}`;

    if (pendingCancelKeys[orderKey] || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmittingOrderKey(orderKey);

    let txHash = "";
    try {
      const { session, walletData } = await retryWalletAccess();

      const response = await fetchBackend("/build-cancel-order-tx", {
        method: "POST",
        token: session.token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          walletVK,
          walletCollateral: walletData.collateral ?? null,
          walletUtxos: walletData.walletUtxos ?? [],
          orderTxHash: order.txHash,
          orderOutputIndex,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = String(errorData?.error ?? `Failed to build cancel tx: ${response.status}`);

        if (response.status === 409 || /already batched|already cancelled|not found/i.test(message)) {
          toast.info("Order is already processed. Refreshing list...");
          await refreshWalletStateAfterTx();
          window.dispatchEvent(new CustomEvent("lava:refresh-home-data"));
          setSubmittingOrderKey("");
          setIsSubmitting(false);
          return;
        }

        throw new Error(message);
      }

      const data = await response.json();
      const signedTx = await (wallet as unknown as MeshFullTxWallet).signTxReturnFullTx(String(data.unsignedTx), true);
      txHash = await wallet.submitTx(signedTx);
    } catch (e) {
      setSubmittingOrderKey("");
      setIsSubmitting(false);
      toastFailure(e);
      console.error("e tx:", e);
      console.log("Err in handle cancel order");
      return;
    }

    setPendingCancelKeys((previous) => ({
      ...previous,
      [orderKey]: true,
    }));
    setSubmittingOrderKey("");
    setIsSubmitting(false);
    toastSuccess(txHash);
    await refreshWalletStateAfterTx();
    window.dispatchEvent(new CustomEvent("lava:refresh-home-data"));
    console.log("Cancel order tx hash:", txHash);
  };

  const getOrderCreatedAt = (order: UserOrderType): number => {
    if (order.firstSeenAt && order.firstSeenAt > 0) {
      return order.firstSeenAt;
    }
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(`lava_order_time_${order.txHash}`);
        if (stored) {
          const parsed = Number(stored);
          if (!isNaN(parsed) && parsed > 0) {
            return parsed;
          }
        }
      } catch {
        // Ignore storage read failures
      }
    }
    return 0;
  };

  return (
    <div
      className="mx-auto mt-6 w-full max-w-[520px] p-[22px] sm:p-6 text-white"
      style={{
        borderRadius: '22px',
        background: 'linear-gradient(180deg, #0d1116 0%, #11131a 55%, #241413 85%, #4a1f18 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07), 0 25px 50px -12px rgba(0,0,0,0.25)',
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Slug>/orders</Slug>
          <span className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">
            {connected ? `${displayOrders.length} pending` : "0 pending"}
          </span>
        </div>

        {!connected ? (
          <div className="lava-well flex items-center justify-center p-6 text-center border border-white/[0.06] bg-white/[0.02]">
            <p className="font-mono-lava text-[12px] uppercase tracking-[0.02em] text-dim">
              Connect wallet to view orders
            </p>
          </div>
        ) : displayOrders.length === 0 ? (
          <div className="lava-well flex items-center justify-center p-6 text-center border border-white/[0.06] bg-white/[0.02]">
            <p className="font-mono-lava text-[12px] uppercase tracking-[0.02em] text-dim">
              No pending orders
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {displayOrders.map((order) => {
              const orderKey = `${order.txHash}-${order.outputIndex ?? 0}`;
              const isBusy =
                (isSubmitting && submittingOrderKey === orderKey) || !!pendingCancelKeys[orderKey];
              const createdAt = getOrderCreatedAt(order);
              const remainingSeconds = createdAt > 0
                ? Math.max(0, 60 - Math.floor((now - createdAt) / 1000))
                : 0;

              return (
                <div
                  key={orderKey}
                  className="lava-well flex items-center justify-between gap-4 p-4 border border-white/[0.08] bg-[#12161f]/80 transition-all hover:border-white/[0.14] hover:bg-[#151a24]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <TokenIcon symbol={order.tokenName} size={34} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="tabular truncate text-[15px] font-semibold text-white tracking-tight">
                          {formatOrderAmount(order)} {order.tokenName}
                        </p>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono-lava uppercase tracking-[0.02em] font-medium ${
                            order.isOptIn
                              ? "bg-[#ff9a4d]/15 text-[#ff9a4d] border border-[#ff9a4d]/30"
                              : "bg-[#df473d]/15 text-[#df473d] border border-[#df473d]/30"
                          }`}
                        >
                          {order.isOptIn ? "opt-in" : "redeem"}
                        </span>
                      </div>
                      <a
                        href={getTransactionExplorerUrl(order.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono-lava text-[12px] text-dim transition-colors hover:text-[#ff9a4d] hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <span>{order.txHash.slice(0, 10)}…{order.txHash.slice(-6)}</span>
                      </a>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {remainingSeconds > 0 ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => await handleCancelOrder(order)}
                        disabled={!walletAddress || !walletVK || isSubmitting || isBusy}
                        className="border border-[#df473d]/40 text-[#df473d] hover:bg-[#df473d]/15 font-mono-lava text-[12px]"
                      >
                        <XCircle className="h-4 w-4 mr-1.5" />
                        {isBusy ? "Processing…" : `Cancel (${remainingSeconds}s)`}
                      </Button>
                    ) : (
                      <span className="font-mono-lava text-[12px] uppercase tracking-[0.02em] text-[#ff9a4d] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ff9a4d]/15 border border-[#ff9a4d]/30 shadow-[0_0_12px_rgba(255,154,77,0.15)]">
                        <span className="h-2 w-2 rounded-full bg-[#ff9a4d] animate-pulse" />
                        Processing…
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
