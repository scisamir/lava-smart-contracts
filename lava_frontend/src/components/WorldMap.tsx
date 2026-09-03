import { WORLD_MAP } from "@/lib/images";

interface ValidatorLocation {
  name: string;
  x: number;
  y: number;
  stake: string;
}

const VALIDATORS: ValidatorLocation[] = [
  { name: "Hyperlend", x: 15, y: 45, stake: "1,000 ADA" },
  { name: "Pendle", x: 75, y: 35, stake: "1,000 ADA" },
  { name: "Project X", x: 50, y: 55, stake: "1,000 ADA" },
  { name: "Valantis", x: 35, y: 25, stake: "1,000 ADA" },
  { name: "Hydra", x: 85, y: 65, stake: "1,000 ADA" },
];

const WorldMap = () => (
  <div className="relative h-[300px] w-full md:h-[400px]">
    <img
      src={WORLD_MAP.src}
      alt="World map showing validator locations"
      className="absolute inset-0 h-full w-full object-contain opacity-60"
    />

    <svg
      viewBox="0 0 1200 400"
      className="relative z-10 h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        {/* The same ember halo the landing page puts under its coins. */}
        <radialGradient id="mapHalo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff9a5a" stopOpacity="0.85" />
          <stop offset="0.5" stopColor="#ff5a33" stopOpacity="0.3" />
          <stop offset="1" stopColor="#ff5a33" stopOpacity="0" />
        </radialGradient>
      </defs>

      {VALIDATORS.map((validator, index) => {
        const x = (validator.x / 100) * 1200;
        const y = (validator.y / 100) * 400;

        return (
          <g key={validator.name}>
            <circle cx={x} cy={y} r="26" fill="url(#mapHalo)" />
            <circle cx={x} cy={y} r="3.5" fill="#ffd9a8" />
            <circle
              cx={x}
              cy={y}
              r="9"
              fill="none"
              stroke="#ff9a4d"
              strokeWidth="1"
              opacity="0.5"
              className="animate-ping"
              style={{ animationDuration: "3s", animationDelay: `${index * 0.4}s`, transformBox: "fill-box", transformOrigin: "center" }}
            />
          </g>
        );
      })}

      {/* Callout for the largest vault. */}
      <g>
        <rect
          x="100"
          y="132"
          width="152"
          height="58"
          rx="16"
          fill="#0d1116"
          stroke="rgba(255,255,255,0.09)"
        />
        <text x="120" y="156" fill="#ffffff" fontSize="15" fontWeight="500" letterSpacing="-0.3">
          Hyperlend
        </text>
        <circle cx="126" cy="172" r="3" fill="#ff9a4d" />
        <text x="138" y="177" fill="rgba(255,255,255,0.52)" fontSize="12">
          1,000 ADA
        </text>
      </g>
    </svg>
  </div>
);

export default WorldMap;
