import { LAVA_LOGO } from "@/lib/images";
import footerBg from "@/assets/footer-bg.png";
import mobileFt from "@/assets/mobile-ft.png";

const Footer = () => {
  return (
    <footer
      className="relative overflow-hidden bg-no-repeat"
      style={{
        backgroundImage: `url(${footerBg.src})`,
        backgroundRepeat: 'no-repeat',
        /* use explicit image pixel dimensions so the full image is visible */
        backgroundSize: '1600.500244140625px 130.7198486328125px',
        backgroundPosition: '-69px 0.15px',
        height: '120.7198486328125px',
      }}
    >
      {/* Mobile overrides: use exact mobile image size, position and height */}
      <style jsx>{`
        @media (max-width: 768px) {
          footer {
            background-image: url(${mobileFt.src}) !important;
            background-repeat: no-repeat !important;
            background-size: 1500.2469482421875px 200.98828125px !important;
            background-position: -476.75px 0.15px !important;
            height: 200.98828125px !important;
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