import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { StakingCard } from "@/components/home/StakingCard";
import { StatsSection } from "@/components/home/StatsSection";
import { ProtocolsSection } from "@/components/home/ProtocolsSection";
import { SecuritySection } from "@/components/home/SecuritySection";
import { CTASection } from "@/components/home/CTASection";
import appBg from "@/assets/app-bg.png";
import { OrderList } from "@/components/home/OrderList";
import { useEffect, useState } from "react";
import { fetchUserOrders, getTotalOrderNumbers } from "@/e2e/utils";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";
import { UserOrderType } from "@/lib/types";
import { BatchOrders } from "@/components/stake/BatchOrders";

const Index = () => {
  const { blockchainProvider, walletAddress, walletUtxos, wallet } =
    useCardanoWallet();
  const [orders, setOrders] = useState<UserOrderType[]>([]);
  const [totalOrder, setTotalOrder] = useState({});

  useEffect(() => {
    if (blockchainProvider) {
      const awaitFetchUserOrders = async () => {
        const userOrders = await fetchUserOrders(
          blockchainProvider,
          walletAddress
        );
        setOrders(userOrders);
        console.log("userOrders:", userOrders);

        const orderTotals = await getTotalOrderNumbers(blockchainProvider);
        setTotalOrder(orderTotals);
      };

      awaitFetchUserOrders();

      const interval = setInterval(awaitFetchUserOrders, 10000);

      return () => clearInterval(interval);
    }
  }, [blockchainProvider, walletAddress]);

  return (
    <div className="index-container bg-background flex flex-col min-h-screen">
      <Navigation />

      <div className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${appBg.src})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                opacity: 0.1,
              }}
            />
          </div>

          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center max-w-4xl mx-auto mb-16">
              <h1 className="text-5xl md:text-7xl font-bold mb-6">
                POWERING {" "}
                <span className="text-gradient-lava">LIQUID STAKING</span>
                <br />
                ON CARDANO
              </h1>
            </div>

            <StatsSection />
            <StakingCard />
            <OrderList orders={orders} />
            <BatchOrders totalOrder={totalOrder} />
          </div>
        </section>

        <ProtocolsSection />
        <SecuritySection />
        <CTASection />
      </div>

      <Footer />

      {/* Use flex layout + `min-h-screen` on the root so desktop pages resize dynamically
				Footer will naturally sit at the bottom because the main content uses `flex-1`.
				Removed hard-coded pixel min-heights to allow the page to fit large screens. */}
    </div>
  );
};

export default Index;
