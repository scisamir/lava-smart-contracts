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
import { BG_BEHIND } from "@/lib/images";

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
    <div
      className="index-container flex flex-col min-h-screen"
      style={{ background: "#000000", position: "relative" }}
    >
      <Navigation />

      <div className="flex-1">
        {/* Hero Section */}
        <section
          className="relative overflow-hidden flex flex-col items-center"
          style={{ padding: "164px 0px 64px", gap: "64px", isolation: "isolate" }}
        >


                <div className="absolute inset-0 pointer-events-none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 0 }}>
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      backgroundImage: `url(${appBg.src})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      opacity: 0.1,
                    }}
                  />
                </div>

                <div className="container mx-auto px-4 relative z-10 flex flex-col items-center">
                  {/* Center column matching design (644px) */}
                  <div style={{ width: 644, display: "flex", flexDirection: "column", alignItems: "center", gap: 32, position: "relative", isolation: "isolate", zIndex: 1 }}>
                    <div
                      style={{
                        position: "absolute",
                        width: 1822,
                        height: 557,
                        left: "calc(50% - 1822px/2 + 0.36px)",
                        top: -129.25,
                        backgroundImage: `url(${BG_BEHIND.src})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        mixBlendMode: "screen",
                        opacity: 0.50,
                        zIndex: 1,
                        pointerEvents: "none",
                      }}
                    />

                    <div style={{ width: 644, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <h1
                        style={{
                          width: 569,
                          height: 116,
                          fontFamily: "Pixelify Sans, ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial",
                          fontWeight: 400,
                          fontSize: 48,
                          lineHeight: "58px",
                          textAlign: "center",
                          letterSpacing: "-0.02em",
                          textTransform: "uppercase",
                          color: "#FFFFFF",
                          zIndex: 2,
                        }}
                      >
                        POWERING {" "}
                        <span className="text-gradient-lava">LIQUID STAKING</span>
                        <br />
                        ON CARDANO
                      </h1>
                    </div>

                    <StatsSection />
                    <StakingCard />
                  </div>

                  <OrderList orders={orders} />
                  <BatchOrders totalOrder={totalOrder} />
                </div>
        </section>

        <ProtocolsSection />
        <SecuritySection />
        <CTASection />
      </div>

      <Footer />

      
    </div>
  );
};

export default Index;
