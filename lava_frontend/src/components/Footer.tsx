import { LAVA_LOGO } from "@/lib/images";
import footerBg from "@/assets/footer-bg.png";

const Footer = () => {
  return (
    <footer 
      className="relative bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `url(${footerBg.src})`,
        height: '120px',
      }}
    >
      {/* Dim + blur overlay to reduce shine */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-none" />
      {/* Mobile: taller footer */}
      <style jsx>{`
        @media (max-width: 768px) {
          footer {
            height: 247px !important;
          }
        }
      `}</style>
      
      <div className="container mx-auto px-4 h-full flex items-end pb-6 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
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
            <a href="/portfolio" className="text-white/80 hover:text-white transition-colors text-sm">
              Portfolio
            </a>
            
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;