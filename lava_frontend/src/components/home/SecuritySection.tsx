import { Section, SectionIntro } from "@/components/layout/Section";
import { SHIELD_ICON, AUDITO_LOGO } from "@/lib/images";

const PARTNERS = [
  {
    name: "UTxO Company",
    role: "Security auditor",
    logo: AUDITO_LOGO.src,
    href: "https://x.com/utxo_company",
    imgClass: "h-32 w-32 object-contain",
  },
  {
    name: "FluidTokens",
    role: "Development partner",
    /* The square 714x720 icon from public/assets, not the 185x53 wordmark in
       src/assets. At this size the wordmark would upscale and go soft next
       to UTxO's 512px mark, and the name is already set in text below. */
    logo: "/assets/fldt.png",
    href: "https://fluidtokens.com",
    imgClass: "h-32 w-32 rounded-2xl object-contain",
  },
];

export const SecuritySection = () => (
  <Section>
    <div className="shell">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <div data-reveal className="order-2 flex justify-center lg:order-1 lg:justify-start">
          <img
            src={SHIELD_ICON.src}
            alt=""
            aria-hidden="true"
            className="w-full max-w-sm object-contain"
          />
        </div>

        <div className="order-1 lg:order-2">
          <SectionIntro
            align="left"
            heading={
              <>
                Built and secured by industry
                <br />
                leading <span className="text-sheen">auditors</span>
              </>
            }
          />

          <div className="flex flex-wrap gap-4">
            {PARTNERS.map((partner, index) => (
              <a
                key={partner.name}
                data-reveal
                style={{ ["--reveal-delay" as string]: `${0.07 + index * 0.06}s` }}
                href={partner.href}
                target="_blank"
                rel="noopener noreferrer"
                className="lava-panel group flex min-w-[240px] flex-1 flex-col items-center gap-6 p-8 no-underline transition-transform duration-300 ease-lava hover:-translate-y-1"
              >
                {/* Fixed-height plate so a square mark and a wordmark still
                    line up across the row. */}
                <span className="relative z-[4] grid h-32 w-full place-items-center">
                  <img src={partner.logo} alt={partner.name} className={partner.imgClass} />
                </span>
                <span className="relative z-[4] text-center">
                  <span className="block text-[18px] font-medium tracking-tighter">
                    {partner.name}
                  </span>
                  <span className="mt-1 block font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">
                    {partner.role}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  </Section>
);
