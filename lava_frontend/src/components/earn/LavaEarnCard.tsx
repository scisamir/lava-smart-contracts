import { Slug } from "@/components/layout/Section";
import { LadaMark } from "@/components/brand/LadaMark";
/* Square icon art from public/assets. The *-logo.png files in src/assets are
   wide wordmarks that turn to mush inside a 24px avatar. */
const REWARDS = [
  { src: "/assets/fldt.png", alt: "FluidTokens" },
  { src: "/assets/minswap.png", alt: "Minswap" },
  { src: "/assets/indigo.png", alt: "Splash" },
];

const FIGURES = [
  { label: "APY", value: "6.3%" },
  { label: "TVL", value: "$32.43M" },
  { label: "Infra", value: "Veda" },
];

export const LavaEarnCard = () => (
  <div data-reveal className="lava-card lava-card--soft w-full p-6">
    <div className="relative z-[4] flex h-full flex-col justify-between gap-6">
      <div>
        <Slug>/earn</Slug>
        <div className="mt-4 flex items-center gap-3">
          <LadaMark className="h-7 w-7 text-lava-ember" />
          <h3 className="text-[26px] font-medium tracking-tightest">Lava Earn</h3>
        </div>
        <p className="mt-3 max-w-[46ch] text-[13.5px] leading-[1.5] text-dim">
          Route L&#8209;ADA into curated strategies across Cardano DeFi and keep the underlying
          staking yield compounding underneath.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {FIGURES.map((figure) => (
          <div key={figure.label}>
            <p className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">
              {figure.label}
            </p>
            <p className="tabular mt-1.5 text-[20px] font-medium tracking-tightest">
              {figure.value}
            </p>
          </div>
        ))}

        <div>
          <p className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">Rewards</p>
          <div className="mt-1.5 flex items-center">
            {REWARDS.map((reward, index) => (
              <img
                key={reward.alt}
                src={reward.src}
                alt={reward.alt}
                title={reward.alt}
                className={`h-6 w-6 rounded-full bg-[#0a0a0c] object-cover shadow-[0_0_0_2px_#14100f] ${
                  index > 0 ? "-ml-2" : ""
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);
