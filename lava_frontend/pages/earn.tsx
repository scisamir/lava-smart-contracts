import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { ComingSoon } from "@/components/layout/ComingSoon";

/* The built-out version of this page lives in src/components/earn/
   (LavaEarnCard, ProtocolsTable) and can be dropped back in when the yield
   venues are live. */
const Earn = () => (
  <div className="flex min-h-screen flex-col">
    <Navigation />
    <main className="flex-1 pt-[68px]">
      <ComingSoon slug="/earn" title={<>Yield <span className="text-sheen">farming</span></>}>
        Routing L&#8209;ADA into curated strategies across Cardano DeFi. We&rsquo;re finishing the
        integrations and the risk disclosures before opening this up.
      </ComingSoon>
    </main>
    <Footer />
  </div>
);

export default Earn;
