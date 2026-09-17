import { LAVA_LOGO } from "@/lib/images";

const Footer = () => {
  return (
    <footer
      className="relative bg-[#0D0D0D] overflow-hidden flex items-center h-[160px] md:h-[96px]"
    >
      {/* BACKGROUND TYPOGRAPHY */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Large dark layers */}
          <span className="absolute left-[-10%] text-[150px] leading-none font-pixel text-[#303030] opacity-40 whitespace-nowrap" style={{ display: 'block', lineHeight: 1, transform: 'translateY(-30px)' }}>
            Liquid staking Standard
          </span>

          <span className="absolute left-[10%] text-[150px] leading-none font-pixel text-[#303030] opacity-80 whitespace-nowrap" style={{ display: 'block', lineHeight: 1, transform: 'translateY(-30px)' }}>
            Liquid staking Standard
          </span>

        {/* Light subtle layers */}
          <span className="absolute left-[30%] text-[150px] leading-none font-pixel text-white opacity-[0.04] whitespace-nowrap" style={{ display: 'block', lineHeight: 1, transform: 'translateY(-30px)' }}>
            Liquid staking Standard
          </span>

          <span className="absolute left-[20%] text-[120px] leading-none font-pixel text-white opacity-[0.04] whitespace-nowrap" style={{ display: 'block', lineHeight: 1, transform: 'translateY(-20px)' }}>
            Liquid staking Standard
          </span>
      </div>

      {/* FOREGROUND CONTENT */}
      <div className="container mx-auto px-6 relative z-10 h-full">
        <div className="flex flex-col md:flex-row h-full">

          {/* Logo - top on mobile, left on desktop */}
          <div className="flex items-center gap-[14px] md:items-center md:justify-start">
            <img src={LAVA_LOGO.src} alt="Lava" className="w-6 h-6" />
            <span className="text-xl font-bold text-[#D5463E]">
              lava
            </span>
          </div>

          {/* Copyright - centered vertically on mobile, center on desktop */}
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[14px] text-white opacity-60 no-pixelify text-center">
              © 2025 Lava. All rights reserved
            </p>
          </div>

          {/* Navigation - bottom on mobile, right on desktop */}
          <div className="flex items-center gap-6 justify-center md:justify-end">
            <a href="/stake" className="text-white hover:opacity-80">
              Stake
            </a>
            <a href="/earn" className="text-white hover:opacity-80">
              Earn
            </a>
            <a href="/vaults" className="text-white hover:opacity-80">
              Vaults
            </a>
            <a href="/portfolio" className="text-white hover:opacity-80">
              Portfolio
            </a>
          </div>

        </div>
      </div>
      {/* Mobile-only background spans (top/mid/bottom) */}
      <span className="footer-bg-top">Liquid staking Standard</span>
      <span className="footer-bg-mid">Liquid staking Standard</span>
      <span className="footer-bg-bottom">Liquid staking Standard</span>
    </footer>
  );
};

export default Footer;
