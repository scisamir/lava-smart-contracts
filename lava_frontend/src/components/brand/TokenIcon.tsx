import * as React from "react";
import { LadaMark } from "./LadaMark";
import { cn } from "@/lib/utils";
import {
  ADA_LOGO,
  SPLASH_LOGO,
  STRIKETOKENS_LOGO,
  FLUIDTOKENS_LOGO,
} from "@/lib/images";

/* Raster art for the tokens that have their own brand mark. LADA is
   deliberately absent. It renders from the vector mark below, because the
   bundled lava-colorful.png is a 41x40 bitmap that blurs at any real size. */
const RASTER: Record<string, string | undefined> = {
  ADA: ADA_LOGO?.src,
  tStrike: STRIKETOKENS_LOGO?.src,
  tPulse: SPLASH_LOGO?.src,
  test: FLUIDTOKENS_LOGO?.src,
};

/* Every Lava-issued derivative gets the L-ADA mark. */
const isLavaToken = (symbol?: string) => {
  const s = String(symbol ?? "").toUpperCase();
  return s === "LADA" || s.startsWith("L") && s.endsWith("ADA");
};

export const TokenIcon = ({
  symbol,
  size = 36,
  className,
}: {
  symbol?: string;
  size?: number;
  className?: string;
}) => {
  const dimension = { width: size, height: size };

  if (isLavaToken(symbol)) {
    // The landing page's `.chip--lada`: dark disc, ember hairline, mark at ~58%.
    return (
      <span
        className={cn("grid shrink-0 place-items-center rounded-full", className)}
        style={{
          ...dimension,
          background: "#1a0c0e",
          boxShadow: "0 6px 18px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,122,82,0.55)",
        }}
        title={symbol}
      >
        <LadaMark
          className="text-lava-ember"
          style={{ width: size * 0.58, height: size * 0.58 }}
        />
      </span>
    );
  }

  const src = RASTER[String(symbol ?? "")];

  if (!src) {
    return (
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-full bg-white/[0.06] font-medium",
          className,
        )}
        style={{ ...dimension, fontSize: size * 0.4 }}
        title={symbol}
      >
        {String(symbol ?? "?").charAt(0)}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#0a0a0c]",
        className,
      )}
      style={{ ...dimension, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}
      title={symbol}
    >
      <img
        src={src}
        alt=""
        style={{ width: size * 0.62, height: size * 0.62 }}
        className="object-contain"
      />
    </span>
  );
};

export default TokenIcon;
