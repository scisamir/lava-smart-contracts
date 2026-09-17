import Link from "next/link";
import { Section } from "@/components/layout/Section";

export const CTASection = () => (
  <Section className="overflow-hidden">
    <div className="shell">
      <div
        data-reveal
        className="lava-card mx-auto flex flex-col items-center gap-6 px-6 py-[clamp(48px,8vw,88px)] text-center"
      >
        <div className="relative z-[4] flex flex-col items-center gap-4">
          <h2 className="m-0 max-w-[20ch] text-[clamp(30px,4vw,52px)] font-medium leading-[1.1] tracking-tightest">
            Stake ADA or use DeFi? <span className="text-sheen">End the trade-off</span>
          </h2>
          <p className="max-w-[52ch] text-[clamp(14px,1.2vw,17px)] leading-[1.55] tracking-tighter text-dim">
            On Cardano, moving ADA into a DEX or a lending market usually means it stops earning
            staking rewards. L&#8209;ADA keeps that exposure running while the token works
            everywhere else.
          </p>
        </div>

        <Link href="/stake" className="lava-pill relative z-[4]">
          Stake now <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </div>
  </Section>
);
