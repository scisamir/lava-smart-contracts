const STATS = [
  { label: "TVL", value: "$3.21M" },
  { label: "Staking APY", value: "4.32%" },
  { label: "Holders", value: "2,325" },
];

export const StatsSection = () => (
  <div
    data-reveal
    className="lava-panel mx-auto grid w-full max-w-[644px] grid-cols-3 divide-x divide-white/[0.06]"
  >
    {STATS.map((stat) => (
      <div
        key={stat.label}
        className="relative z-[4] flex flex-col items-center gap-2 px-3 py-6 sm:px-6"
      >
        {/* Labels vary in length ("Staking APY" vs "TVL"), so the column is
            centred on the value and the label is allowed its own line. */}
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
