import { SHIELD_ICON, AUDITO_LOGO } from "@/lib/images";

export const SecuritySection = () => {
  // Single auditor (UTxO Company)
  const auditor = { name: "UTxO COMPANY", logo: AUDITO_LOGO.src };

  return (
    <section
      className="py-20 bg-background"
      style={{ background: 'var(--Color, #000000)' }}
    >
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
              SECURED BY INDUSTRY
              <br />LEADING <span className="text-gradient-lava">AUDITORS</span>
            </h2>

            <div className="space-y-6">
              <div className="flex flex-col items-center gap-2">
                <a
                  href="https://x.com/utxo_company"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-col items-center no-underline"
                >
                  <div className="p-8 bg-card/50 rounded-lg border border-border shadow-sm flex items-center justify-center">
                    {auditor.logo ? (
                      <img src={auditor.logo} alt={auditor.name} className="h-28 object-contain" />
                    ) : (
                      <p className="font-semibold text-muted-foreground">{auditor.name}</p>
                    )}
                  </div>

                  <div className="text-center mt-1">
                    <p className="font-semibold text-xl text-inherit">{auditor.name}</p>
                  </div>
                </a>

                <p className="text-sm text-muted-foreground">SECURITY AUDITOR</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
