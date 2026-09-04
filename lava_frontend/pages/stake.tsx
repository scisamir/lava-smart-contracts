import Navigation from "@/components/Navigation";
import { PageHeading } from "@/components/layout/Section";
import { HeroGlow } from "@/components/home/HeroGlow";
import Footer from "@/components/Footer";
import { StakingCard } from "@/components/home/StakingCard";
import { StatsSection } from "@/components/home/StatsSection";
import { ProtocolsSection } from "@/components/home/ProtocolsSection";
import { SecuritySection } from "@/components/home/SecuritySection";
import { CTASection } from "@/components/home/CTASection";
import { OrderList } from "@/components/home/OrderList";
import { useEffect, useState } from "react";
import { useCardanoWallet } from "@/hooks/useCardanoWallet";
import { UserOrderType } from "@/lib/types";
import { BatchOrders } from "@/components/stake/BatchOrders";
import { FAQSection } from "@/components/stake/FAQSection";
import { fetchBackend } from "@/lib/backendClient";
import { ensureWalletAuthSession, type WalletSigner } from "@/lib/walletAuth";

const HOME_DATA_REFRESH_EVENT = "lava:refresh-home-data";

const Stake = () => {
  const { wallet, walletAddress } = useCardanoWallet();
  const [orders, setOrders] = useState<UserOrderType[]>([]);
  const [totalOrder, setTotalOrder] = useState({});
  const showBatchButtons = false;

  useEffect(() => {
    const awaitFetchData = async () => {
      try {
        if (walletAddress && wallet) {
          const session = await ensureWalletAuthSession(
            wallet as WalletSigner,
            walletAddress
          );
          const ordersRes = await fetchBackend("/user-orders", {
            token: session.token,
          });

          if (!ordersRes.ok) {
            throw new Error(`Failed to fetch user orders: ${ordersRes.status}`);
          }

          const ordersData = await ordersRes.json();
          setOrders((ordersData?.orders ?? []) as UserOrderType[]);
        } else {
          setOrders([]);
        }

        if (showBatchButtons) {
          const batchStatsRes = await fetchBackend("/batch-stats");
          if (!batchStatsRes.ok) {
            throw new Error(`Failed to fetch batch stats: ${batchStatsRes.status}`);
          }

          const batchStatsData = await batchStatsRes.json();
          setTotalOrder(batchStatsData?.totalOrders ?? {});
        }
      } catch (error) {
        console.error("Failed to fetch home page data:", error);
      }
    };

    awaitFetchData();

    const timeouts: NodeJS.Timeout[] = [];

    const refreshHandler = () => {
      void awaitFetchData();
      // Follow-up fetches to catch on-chain indexing as blocks are minted
      [3000, 8000, 15000, 25000].forEach((delay) => {
        timeouts.push(setTimeout(() => void awaitFetchData(), delay));
      });
    };

    window.addEventListener(HOME_DATA_REFRESH_EVENT, refreshHandler);

    const interval = setInterval(() => {
      void awaitFetchData();
    }, 10_000);

    return () => {
      clearInterval(interval);
      timeouts.forEach(clearTimeout);
      window.removeEventListener(HOME_DATA_REFRESH_EVENT, refreshHandler);
    };
  }, [wallet, walletAddress, showBatchButtons]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navigation />

      <main className="flex-1">
        {/* ---- Hero ---- */}
        <section className="relative isolate overflow-hidden pb-16 pt-[140px] sm:pt-[164px]">
          <HeroGlow />

          <div className="shell relative z-10">
            <div className="mx-auto flex w-full max-w-[644px] flex-col items-center gap-10">
              <PageHeading
                align="center"
                eyebrow="/mint"
                title={
                  <>
                    Powering <span className="text-sheen--cardano">ADA</span>
                    <br />
                    <span className="text-sheen">Liquid Staking</span>
                  </>
                }
              >
                Stake ADA once, mint L&#8209;ADA, then put it to work in lending, liquidity and
                yield markets. Your staking exposure keeps running the whole time.
              </PageHeading>

              <StatsSection />
              <StakingCard />
              <OrderList orders={orders} />
              {showBatchButtons && <BatchOrders totalOrder={totalOrder} />}
            </div>
          </div>
        </section>

        <ProtocolsSection />
        <SecuritySection />

        <section className="bg-background pb-[clamp(24px,4vw,48px)]">
          <div className="shell">
            <FAQSection />
          </div>
        </section>

        <CTASection />
      </main>

      <Footer />
    </div>
  );
};

export default Stake;
