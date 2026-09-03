import * as React from "react";
import { LadaMark } from "./LadaMark";

/*
 * A minting coin, built in CSS 3D rather than WebGL so it costs nothing to
 * load and degrades to a still image under prefers-reduced-motion.
 *
 * Geometry: the faces sit in the XY plane and the coin's thickness runs along
 * Z, so the rim is a cylinder around the Z axis. Each rim segment is placed
 * with `rotateZ(theta) translateY(-r) rotateX(90deg)`: spin it around the
 * circle, push it out to the radius, then tip it upright so its normal points
 * radially outward. The whole assembly rotates about Y.
 */

const RIM_SEGMENTS = 64;

export const SpinningCoin = ({
  size = 260,
  className = "",
}: {
  size?: number;
  className?: string;
}) => {
  const radius = size / 2;
  const thickness = Math.max(10, Math.round(size * 0.075));
  // A hair of overlap stops seams showing between neighbouring segments.
  const segmentWidth = (2 * Math.PI * radius) / RIM_SEGMENTS + 1.5;

  const segments = Array.from({ length: RIM_SEGMENTS }, (_, i) => {
    const angle = (360 / RIM_SEGMENTS) * i;
    // Fake a light from the upper left so the rim reads as a curved surface.
    const shade = 0.42 + 0.58 * Math.abs(Math.cos((angle - 30) * (Math.PI / 180)));
    return { angle, shade };
  });

  return (
    <div
      className={`coin ${className}`}
      style={{ ["--coin-size" as string]: `${size}px` }}
      aria-hidden="true"
    >
      <div className="coin__spin">
        {segments.map(({ angle, shade }) => (
          <span
            key={angle}
            className="coin__rim"
            style={{
              width: segmentWidth,
              height: thickness,
              marginLeft: -segmentWidth / 2,
              marginTop: -thickness / 2,
              transform: `rotateZ(${angle}deg) translateY(${-radius}px) rotateX(90deg)`,
              // Dark metal edge, with a faint ember cast picked up from the mark.
              background: `rgb(${Math.round(52 * shade)}, ${Math.round(44 * shade)}, ${Math.round(
                44 * shade,
              )})`,
            }}
          />
        ))}

        <span className="coin__face" style={{ transform: `translateZ(${thickness / 2}px)` }}>
          <LadaMark
            gradient={["#ff8a4d", "#df473d"]}
            style={{ width: size * 0.52, height: size * 0.52 }}
          />
        </span>

        <span
          className="coin__face coin__face--back"
          style={{ transform: `rotateY(180deg) translateZ(${thickness / 2}px)` }}
        >
          <LadaMark
            gradient={["#ff8a4d", "#df473d"]}
            style={{ width: size * 0.52, height: size * 0.52 }}
          />
        </span>
      </div>

      <span className="coin__shadow" />
    </div>
  );
};

export default SpinningCoin;
