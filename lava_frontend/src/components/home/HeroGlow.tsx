/* The hero's ambient light: the same two radial washes the landing page lays
   over its canvas, so the app opens on the same glow the site closes with. */
export const HeroGlow = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
    <div
      className="absolute inset-x-0 -top-[30%] h-[80vh]"
      style={{
        background:
          "radial-gradient(60% 50% at 50% 40%, rgba(223, 71, 61, 0.20), transparent 70%)",
      }}
    />
    <div
      className="absolute inset-x-0 top-0 h-[70vh]"
      style={{
        background:
          "radial-gradient(40% 34% at 50% 12%, rgba(255, 154, 77, 0.16), transparent 72%)",
      }}
    />
    {/* Grounds the wash so it doesn't smear into the section below. */}
    <div
      className="absolute inset-x-0 bottom-0 h-[40vh]"
      style={{
        background: "linear-gradient(180deg, transparent, #05070a 88%)",
      }}
    />
  </div>
);

export default HeroGlow;
