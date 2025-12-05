"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import { cancelOrder } from "@/e2e/order/cancel_order";
import { UserOrderType } from "@/lib/types";
import { useState } from "react";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";

interface OrderListProps {
  orders: UserOrderType[];
}

export const OrderList = ({ orders }: OrderListProps) => {
  if (orders.length === 0) return null;

  const { connected, txBuilder, blockchainProvider, walletCollateral, wallet, walletAddress, walletVK, walletUtxos } = useCardanoWallet();
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<string>("");

  if (!connected) return null;

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

  const handleCancelOrder = async (orderTxHash: string) => {
      setIsProcessing(true);
      setTxHash(orderTxHash);

      console.log("txBuilder:", txBuilder);
      console.log("walletCollateral:", walletCollateral);
      console.log("blockchainProvider:", blockchainProvider);
  
      if (!txBuilder || !walletCollateral || !blockchainProvider) {
        toastFailure("Error: Check collateral")
        return;
      }
  
      let txHash = "";
      try {
        txHash = await cancelOrder(
          blockchainProvider,
          txBuilder,
          wallet,
          walletAddress,
          walletCollateral,
          walletUtxos,
          walletVK,
          orderTxHash,
        );
        txBuilder.reset();
      } catch (e) {
        txBuilder.reset();
        setTxHash("");
        setIsProcessing(false);
        toastFailure(e);
        console.error("e tx:", e);
        console.log("Err in handle cancel order");
        return;
      }
  
      blockchainProvider.onTxConfirmed(txHash, () => {
        txBuilder.reset();
        setTxHash("");
        setIsProcessing(false);
        toastSuccess(txHash);
        console.log("Cancel order tx hash:", txHash);
      });
    }

  return (
    <Card className="max-w-lg mx-auto p-6 bg-card/80 backdrop-blur-lg border-border shadow-glow-md mt-8">
      {/* Toast */}
      <ToastContainer position='top-right' autoClose={5000} />

      <h2 className="text-xl font-semibold mb-4 text-center">Your Orders</h2>
      <div className="space-y-3">
        {orders.map((order) => (
          <div
            key={order.txHash}
            className="flex items-center justify-between bg-muted/40 rounded-lg p-3"
          >
            <div>
              <p className="font-semibold">{order.amount.toFixed(2)} {order.isOptIn ? "test" : "stTest"} <span className="text-gray-400">({order.isOptIn ? "OptIn Order" : "Redeem Order"})</span></p>
              <a
                href={`https://preprod.cardanoscan.io/transaction/${order.txHash}`}
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
              onClick={async () => await handleCancelOrder(order.txHash)}
              disabled={isProcessing}
            >
              <XCircle className="w-4 h-4 mr-1" /> {(isProcessing && txHash === order.txHash) ? "Processing..." : "Cancel"}
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
};
