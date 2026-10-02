import { useCardanoWallet } from "@/hooks/useCardanoWallet";

const formatTvl = (tvlUsd?: number, tvlAda?: number): string => {
  if (typeof tvlUsd === "number" && tvlUsd > 0) {
    if (tvlUsd >= 1_000_000) {
      return `$${(tvlUsd / 1_000_000).toFixed(2)}M`;
    }
    if (tvlUsd >= 100_000) {
      return `$${(tvlUsd / 1_000).toFixed(0)}k`;
    }
    if (tvlUsd >= 1_000) {
      return `$${(tvlUsd / 1_000).toFixed(1)}k`;
    }
    return `$${tvlUsd.toFixed(2)}`;
  }
  if (typeof tvlAda === "number" && tvlAda > 0) {
    return `${tvlAda.toLocaleString(undefined, { maximumFractionDigits: 0 })} ADA`;
  }
  return "$0.00";
};

export const StatsSection = () => {
  const { protocolStats, vaultsLoading } = useCardanoWallet();

  const tvlDisplay =
    vaultsLoading && !protocolStats
      ? "—"
      : formatTvl(protocolStats?.tvlUsd, protocolStats?.tvlAda);

  const apyDisplay =
    vaultsLoading && !protocolStats
      ? "—"
      : protocolStats?.stakingApy ?? "3.65%";

  const holdersDisplay =
    vaultsLoading && !protocolStats
      ? "—"
      : protocolStats?.holders
      ? protocolStats.holders.toLocaleString()
      : "—";

  const stats = [
    { label: "TVL", value: tvlDisplay },
    { label: "Staking APY", value: apyDisplay },
    { label: "Holders", value: holdersDisplay },
  ];

  return (
    <div
      data-reveal
      className="lava-panel mx-auto grid w-full max-w-[644px] grid-cols-3 divide-x divide-white/[0.06]"
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="relative z-[4] flex flex-col items-center gap-2 px-3 py-6 sm:px-6"
        >
          <p className="text-center font-mono-lava text-[10px] uppercase leading-[1.3] tracking-[0.02em] text-dim sm:text-[11px]">
            {stat.label}
          </p>
          <p className="tabular text-center text-[clamp(22px,2.6vw,32px)] font-medium leading-none tracking-tightest">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
};
