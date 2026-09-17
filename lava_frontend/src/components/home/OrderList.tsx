"use client";

import { Button } from "@/components/ui/button";
import { Slug } from "@/components/layout/Section";
import { XCircle } from "lucide-react";
import { toast } from "react-toastify";
import { MeshFullTxWallet, OrderListProps, UserOrderType } from "@/lib/types";
import { useEffect, useState } from "react";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";
import { fetchBackend } from "@/lib/backendClient";
import { getTransactionExplorerUrl } from "@/lib/networkConfig";
import { resolveTxHash } from "@meshsdk/core";

export const OrderList = ({ orders }: OrderListProps) => {
  const [pendingCancelKeys, setPendingCancelKeys] = useState<Record<string, true>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittingOrderKey, setSubmittingOrderKey] = useState<string>("");

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

  const hasVisibleOrders =
    orders.length > 0 || Object.keys(pendingCancelKeys).length > 0;
  if (!hasVisibleOrders) return null;

  const formatOrderAmount = (order: UserOrderType) => {
    const token = String(order.tokenName ?? "").toUpperCase();
    if (token === "ADA" || token === "LADA") {
      return (order.amount / 1_000_000).toFixed(2);
    }

    return order.amount.toFixed(2);
  };

  if (!connected) return null;

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

      let currentUtxos = walletData.walletUtxos ?? [];
      try {
        if (typeof (wallet as any).getUtxos === "function") {
          const liveUtxos = await (wallet as any).getUtxos();
          if (Array.isArray(liveUtxos) && liveUtxos.length > 0) {
            currentUtxos = liveUtxos;
          }
        }
      } catch (utxoErr) {
        console.warn("[OrderList] wallet.getUtxos fallback:", utxoErr);
      }

      let currentCollateral = walletData.collateral ?? null;
      try {
        if (typeof (wallet as any).getCollateral === "function") {
          const liveCollateral = await (wallet as any).getCollateral();
          if (Array.isArray(liveCollateral) && liveCollateral.length > 0) {
            currentCollateral = liveCollateral[0];
          }
        }
      } catch (colErr) {
        console.warn("[OrderList] wallet.getCollateral fallback:", colErr);
      }

      const response = await fetchBackend("/build-cancel-order-tx", {
        method: "POST",
        token: session.token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          walletVK,
          walletCollateral: currentCollateral,
          walletUtxos: currentUtxos,
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
      try {
        txHash = await wallet.submitTx(signedTx);
      } catch (submitErr: any) {
        const errMsg = String(submitErr?.data?.error || submitErr?.message || submitErr);
        if (/already been included|all inputs are spent/i.test(errMsg)) {
          try {
            txHash = resolveTxHash(signedTx);
            console.warn("[OrderList] Tx already included in mempool, resolved txHash:", txHash);
          } catch (hashErr) {
            console.warn("[OrderList] Failed to resolveTxHash:", hashErr);
            throw submitErr;
          }
        } else {
          throw submitErr;
        }
      }
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

  return (
    <div data-reveal className="lava-panel mx-auto mt-8 w-full max-w-[520px] p-6">
      <div className="relative z-[4]">
        <div className="mb-4 flex items-center justify-between">
          <Slug>/orders</Slug>
          <span className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">
            {orders.length} pending
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {orders.map((order) => {
            const orderKey = `${order.txHash}-${order.outputIndex ?? 0}`;
            const isBusy =
              (isSubmitting && submittingOrderKey === orderKey) || !!pendingCancelKeys[orderKey];

            return (
              <div
                key={orderKey}
                className="lava-well flex items-center justify-between gap-4 p-3.5"
              >
                <div className="min-w-0">
                  <p className="tabular truncate text-[15px] font-medium tracking-tighter">
                    {formatOrderAmount(order)} {order.tokenName}
                    <span className="ml-2 font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">
                      {order.isOptIn ? "opt-in" : "redeem"}
                    </span>
                  </p>
                  <a
                    href={getTransactionExplorerUrl(order.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono-lava text-[12px] text-dim transition-colors hover:text-[#ff9a4d]"
                  >
                    {order.txHash.slice(0, 10)}…
                  </a>
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => await handleCancelOrder(order)}
                  disabled={!walletAddress || !walletVK || isSubmitting || isBusy}
                >
                  <XCircle className="h-4 w-4" />
                  {isBusy ? "Processing…" : "Cancel"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
