import {
  FLAME_GRAPHIC,
  FLUIDTOKENS_LOGO,
  MINSWAP_LOGO,
  STRIKEFINANCE_LOGO,
  SPLASH_LOGO,
  LIQWID_LOGO,
  IAGON_LOGO,
  CIRCLE_LOGO,
} from "@/lib/images";

export const ProtocolsSection = () => {
  const protocolsFrame1 = [
  { name: "FluidTokens", logo: FLUIDTOKENS_LOGO.src },
  { name: "Minswap", logo: MINSWAP_LOGO.src },
  { name: "Strike Finance", logo: STRIKEFINANCE_LOGO.src },
  ];

  const protocolsFrame2 = [
  { name: "Splash", logo: SPLASH_LOGO.src },
  { name: "Liqwid", logo: LIQWID_LOGO.src },
  { name: "Iagon", logo: IAGON_LOGO.src },
  { name: "Circle", logo: CIRCLE_LOGO.src },
  ];

  return (
    <section
      className="py-20 relative bg-background"
      style={{ background: 'var(--Color, #000000)' }}
    >
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              WORKING WITH TOP PROTOCOLS
              <br />ACROSS <span className="text-gradient-lava">CARDANO</span>
            </h2>
            
            <div className="space-y-6 mt-8">
              {/* Frame 1 - Logo Images */}
              <div className="grid grid-cols-3 gap-6">
                {protocolsFrame1.map((protocol, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-center p-4"
                  >
                    <img 
                      src={protocol.logo} 
                      alt={protocol.name} 
                      className="max-w-full h-auto"
                    />
                  </div>
                ))}
              </div>

              {/* Frame 2 - Logo Images */}
              <div className="grid grid-cols-4 gap-6">
                {protocolsFrame2.map((protocol, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-center p-4"
                  >
                    <img 
                      src={protocol.logo} 
                      alt={protocol.name} 
                      className="max-w-full h-auto"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

            <div className="flex justify-center lg:justify-end">
            <img 
              src={FLAME_GRAPHIC.src} 
              alt="Lava flame graphic" 
              className="w-full max-w-md"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
