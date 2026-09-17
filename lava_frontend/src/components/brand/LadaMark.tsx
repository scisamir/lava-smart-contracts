import * as React from "react";

/* The L-ADA mark, as a 15x15 pixel grid. '#' is an opaque pixel.
   Copied verbatim from the landing page's `scripts/lada-mark.js` so the two
   surfaces render the identical mark. */
const LADA_PIXELS = [
  ".........#...#.",
  ".....#.##..####",
  "....#####.####.",
  "..###########..",
  ".#############.",
  ".#############.",
  "###....####....",
  "##......#####..",
  "##.......###...",
  "#........####..",
  "#........###...",
  "##.......##....",
  ".#......##.....",
  "..##...##......",
  "...#####.......",
];

type Rect = { x: number; y: number; w: number };

/* Runs of adjacent pixels merge into one rect so the mark has no seams. */
const RECTS: Rect[] = (() => {
  const rects: Rect[] = [];

  LADA_PIXELS.forEach((row, y) => {
    let run = 0;
    for (let x = 0; x <= row.length; x++) {
      if (row[x] === "#") {
        run++;
        continue;
      }
      if (run) rects.push({ x: x - run, y, w: run });
      run = 0;
    }
  });

  return rects;
})();

export const LadaMark = ({
  className,
  title,
  gradient,
  ...props
}: React.SVGProps<SVGSVGElement> & {
  title?: string;
  /* Optional [top, bottom] fill. Omit it and the mark inherits currentColor. */
  gradient?: [string, string];
}) => {
  // Unique per instance, so several gradient marks can coexist on one page.
  const gradientId = `lada-${React.useId().replace(/:/g, "")}`;

  return (
    <svg
      viewBox="0 0 15 15"
      fill={gradient ? `url(#${gradientId})` : "currentColor"}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      className={className}
      {...props}
    >
      {title && <title>{title}</title>}
      {gradient && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={gradient[0]} />
            <stop offset="1" stopColor={gradient[1]} />
          </linearGradient>
        </defs>
      )}
      {RECTS.map((rect) => (
        <rect
          key={`${rect.x}-${rect.y}`}
          x={rect.x}
          y={rect.y}
          width={rect.w}
          height={1}
          shapeRendering="crispEdges"
        />
      ))}
    </svg>
  );
};

/* Mark + wordmark, as it appears in the landing page header and footer. */
export const LavaWordmark = ({
  className = "",
  markClassName = "w-[22px] h-[22px] text-lava-ember",
  textClassName = "text-[22px] font-semibold tracking-tightest",
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
}) => (
  <span className={`inline-flex items-center gap-[10px] ${className}`}>
    <LadaMark className={markClassName} />
    <span className={textClassName}>lava</span>
  </span>
);

export default LadaMark;
