import { LAVA_LOGO } from "@/lib/images";
import footerBg from "@/assets/footer-bg.png";

const Footer = () => {
  return (
    <footer
      className="relative overflow-hidden bg-no-repeat"
      style={{
        backgroundImage: `url(${footerBg.src})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        backgroundPosition: 'center bottom',
        /* keep height for layout consistency */
        height: '120.7198486328125px',
      }}
    >
      <style jsx>{`
        footer::before {
          content: "";
          position: absolute;
          inset: 0;
          background: var(--Color-2, #0D0D0D);
          opacity: 0.9;
          z-index: 0;
        }

        /* Mobile: use the same desktop image but adapt positioning/height so it responds
           to different screen sizes. Desktop appearance remains unchanged. */
        @media (max-width: 768px) {
          footer {
            background-position: center center !important;
            background-size: cover !important;
            /* let content dictate height on small screens while keeping some padding */
            height: auto !important;
            padding-top: 1.5rem !important;
            padding-bottom: 1.5rem !important;
          }
        }
      `}</style>
      
  <div className="container mx-auto px-4 h-full flex items-end pb-6 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-2">
            <img src={LAVA_LOGO.src} alt="Lava" className="w-6 h-6" />
            <span className="text-xl font-bold" style={{ color: '#D5463E' }}>lava</span>
          </div>
          
          <p className="text-white/80 text-sm lorem no-pixelify">
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