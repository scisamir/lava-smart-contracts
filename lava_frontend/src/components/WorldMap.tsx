import { useEffect, useRef } from "react";
import { WORLD_MAP } from "@/lib/images";

interface ValidatorLocation {
  name: string;
  x: number;
  y: number;
  stake: string;
}

const WorldMap = () => {
  const canvasRef = useRef<HTMLDivElement>(null);

  const validators: ValidatorLocation[] = [
    { name: "Hyperlend", x: 15, y: 45, stake: "1,000 ADA" },
    { name: "Pendle", x: 75, y: 35, stake: "1,000 ADA" },
    { name: "Project X", x: 50, y: 55, stake: "1,000 ADA" },
    { name: "Valantis", x: 35, y: 25, stake: "1,000 ADA" },
    { name: "Hydra", x: 85, y: 65, stake: "1,000 ADA" },
  ];

  return (
    <div ref={canvasRef} className="relative w-full h-[300px] md:h-[400px]">
      {/* World map image as background */}
      <img 
        src={WORLD_MAP.src} 
        alt="World map showing validator locations" 
        className="absolute inset-0 w-full h-full object-contain"
      />
      
      <svg
        viewBox="0 0 1200 400"
        className="w-full h-full relative z-10"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Validator locations */}
        {validators.map((validator, index) => {
          const x = (validator.x / 100) * 1200;
          const y = (validator.y / 100) * 400;
          
          return (
            <g key={index} className="animate-pulse-glow">
              {/* Location marker - triangle */}
              <polygon
                points={`${x},${y - 15} ${x - 8},${y} ${x + 8},${y}`}
                fill="hsl(var(--primary))"
                className="drop-shadow-glow"
              />
              
              {/* Glow effect */}
              <circle
                cx={x}
                cy={y - 5}
                r="10"
                fill="hsl(var(--primary))"
                opacity="0.3"
                className="animate-ping"
                style={{ animationDuration: '3s' }}
              />
              
              {/* Connection line to ground */}
              <line
                x1={x}
                y1={y}
                x2={x}
                y2={y + 20}
                stroke="hsl(var(--primary))"
                strokeWidth="1"
                opacity="0.4"
                strokeDasharray="2,2"
              />
            </g>
          );
        })}

        {/* Hyperlend tooltip */}
        <g>
          <rect
            x="100"
            y="140"
            width="140"
            height="50"
            rx="8"
            fill="hsl(var(--card))"
            opacity="0.95"
            className="drop-shadow-lg"
          />
          <text
            x="170"
            y="160"
            textAnchor="middle"
            fill="hsl(var(--foreground))"
            fontSize="16"
            fontWeight="600"
          >
            Hyperlend
          </text>
          <circle cx="155" cy="175" r="5" fill="hsl(var(--primary))" />
          <text
            x="170"
            y="180"
            textAnchor="middle"
            fill="hsl(var(--muted-foreground))"
            fontSize="12"
          >
            1,000 ADA
          </text>
        </g>
      </svg>
    </div>
  );
};

export default WorldMap;
