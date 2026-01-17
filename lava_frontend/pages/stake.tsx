import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { StatsSection } from "@/components/home/StatsSection";
import { StakingCard } from "@/components/home/StakingCard";
import appBg from "@/assets/app-bg.png";
import { FAQSection } from "@/components/stake/FAQSection";
const Stake = () => {
	return (
  <div className="min-h-screen">
    <div
      className="app-bg-wrapper"
      style={{ ["--app-bg" as any]: `url(${appBg.src})` } as React.CSSProperties}
    >
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-20">
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-4xl mx-auto mb-12">
            <h1 className="text-5xl md:text-7xl font-bold mb-4">
              LIQUID <span className="text-gradient-lava">STAKING</span>
            </h1>

            <p
              className="text-muted-foreground text-lg"
              style={{
                fontFamily:
                  'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
                fontWeight: 400,
                fontStyle: "normal",
                fontSize: "18px",
                lineHeight: "150%",
                letterSpacing: "-0.02em",
                textAlign: "center",
              }}
            >
              Stake ADA and receive stADA
            </p>
          </div>

          <div className="mx-auto w-[644px]">
            <StatsSection />
            <div className="my-8 flex justify-center">
              <StakingCard />
            </div>
          </div>
        </div>
      </section>
    </div>

    <div className="container mx-auto px-4 relative z-10 mt-6">
      <FAQSection />
    </div>

    <Footer />
  </div>
);
};

export default Stake;
