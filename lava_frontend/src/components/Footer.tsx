import { LAVA_LOGO } from "@/lib/images";

const Footer = () => {
  return (
    <footer className="bg-gradient-to-r from-[hsl(var(--lava-red)/0.7)] via-[hsl(var(--lava-orange)/0.7)] to-[hsl(var(--lava-yellow)/0.7)] relative">
      {/* Wavy contour at top */}
      <div className="absolute top-0 left-0 w-full overflow-hidden leading-none" style={{ transform: 'translateY(-99%)' }}>
        <svg className="relative block w-full h-[60px]" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path 
            d="M0,0 C150,80 350,20 600,60 C850,100 1050,40 1200,80 L1200,120 L0,120 Z" 
            className="fill-[hsl(var(--background)/0.04)]"
          />
        </svg>
      </div>
      
      <div className="container mx-auto px-4 py-8 pt-16">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={LAVA_LOGO.src} alt="Lava" className="w-6 h-6" />
            <span className="text-xl font-bold text-white">lava</span>
          </div>
          
          <p className="text-white/80 text-sm">
            © 2025 Lava. All rights reserved
          </p>

          <div className="flex items-center gap-6">
            <a href="/stake" className="text-white/80 hover:text-white transition-colors text-sm">
              Stake
            </a>
            <a href="/earn" className="text-white/80 hover:text-white transition-colors text-sm">
              Earn
            </a>
            <a href="/validators" className="text-white/80 hover:text-white transition-colors text-sm">
              Validators
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
