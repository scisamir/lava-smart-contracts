"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import { toast } from "react-toastify";
import { OrderListProps, UserOrderType } from "@/lib/types";
import { useEffect, useState } from "react";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";

export const OrderList = ({ orders }: OrderListProps) => {
  const [pendingCancelKeys, setPendingCancelKeys] = useState<Record<string, true>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittingOrderKey, setSubmittingOrderKey] = useState<string>("");

  const {
    connected,
    walletCollateral,
    wallet,
    walletAddress,
    walletVK,
    walletUtxos,
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
      const backendBaseUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL
          ?.replace(/\/lava-vaults\/?$/, "")
          .replace(/\/+$/, "") ||
        "https://xk00c9isg3.execute-api.us-east-1.amazonaws.com/prod";

      const response = await fetch(`${backendBaseUrl}/build-cancel-order-tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          walletVK,
          walletCollateral,
          walletUtxos,
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
      const signedTx = await wallet.signTx(String(data.unsignedTx), true);
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

  return (
    <Card className="max-w-lg mx-auto p-6 bg-card/80 backdrop-blur-lg border-border shadow-glow-md mt-8">
      <h2 className="text-xl font-semibold mb-4 text-center">Your Orders</h2>
      <div className="space-y-3">
        {orders.map((order) => (
          <div
            key={`${order.txHash}-${order.outputIndex ?? 0}`}
            className="flex items-center justify-between bg-muted/40 rounded-lg p-3"
          >
            <div>
              <p className="font-semibold">
                {formatOrderAmount(order)} {order.tokenName}{" "}
                <span className="text-gray-400">
                  ({order.isOptIn ? "OptIn Order" : "Redeem Order"})
                </span>
              </p>
              <a
                href={`https://cardanoscan.io/transaction/${order.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 underline"
              >
                {order.txHash.slice(0, 10)}...
              </a>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => await handleCancelOrder(order)}
              disabled={isSubmitting || !!pendingCancelKeys[`${order.txHash}-${order.outputIndex ?? 0}`]}
            >
              <XCircle className="w-4 h-4 mr-1" />{" "}
              {(isSubmitting && submittingOrderKey === `${order.txHash}-${order.outputIndex ?? 0}`) ||
              pendingCancelKeys[`${order.txHash}-${order.outputIndex ?? 0}`]
                ? "Processing..."
                : "Cancel"}
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
};
