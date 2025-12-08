import {
  SHIELD_ICON,
  PASHOV_LOGO,
  SPEARBIT_LOGO,
  CODE_ARENA_LOGO,
  ZENITH_LOGO,
  SSA_LOGO,
} from "@/lib/images";

export const SecuritySection = () => {
  const auditorsTop = [
  { name: "Pashov Audit Group", logo: PASHOV_LOGO.src },
  { name: "SPEARBIT", logo: SPEARBIT_LOGO.src },
  ];

  const auditorsBottom = [
  { name: "code4rena", logo: CODE_ARENA_LOGO.src },
  { name: "Zenith", logo: ZENITH_LOGO.src },
  { name: "Secure Staking Alliance", logo: SSA_LOGO.src },
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="flex justify-center lg:justify-start order-2 lg:order-1">
            <img 
              src={SHIELD_ICON.src} 
              alt="Security shield" 
              className="w-full max-w-sm object-contain"
            />
          </div>

          <div className="order-1 lg:order-2">
            <h2 className="text-4xl md:text-5xl font-bold mb-8">
              Secured by industry
              <br />leading <span className="text-gradient-lava">auditors</span>
            </h2>

            <div className="space-y-6">
              {/* Top Row - 2 auditors */}
              <div className="grid grid-cols-2 gap-6">
                {auditorsTop.map((auditor, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-center p-4"
                  >
                    {auditor.logo ? (
                      <img 
                        src={auditor.logo} 
                        alt={auditor.name} 
                        className="max-w-full h-auto"
                      />
                    ) : (
                      <p className="font-semibold text-muted-foreground">{auditor.name}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Bottom Row - 3 auditors */}
              <div className="grid grid-cols-3 gap-6">
                {auditorsBottom.map((auditor, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-center p-4"
                  >
                    {auditor.logo ? (
                      <img 
                        src={auditor.logo} 
                        alt={auditor.name} 
                        className="max-w-full h-auto"
                      />
                    ) : (
                      <p className="font-semibold text-muted-foreground">{auditor.name}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
