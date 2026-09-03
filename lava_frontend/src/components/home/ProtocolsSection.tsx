import type { CSSProperties } from "react";
import { Section, SectionIntro } from "@/components/layout/Section";
import {
  FLAME_GRAPHIC,
  FLUIDTOKENS_LOGO,
  MINSWAP_LOGO,
  ATLAS_LOGO,
  SURF_LOGO,
  ATRIUM_LOGO,
} from "@/lib/images";

/* Deliberately not grouped by category, so the row reads as a mixed
   ecosystem rather than a ranked list. */
const PROTOCOLS = [
  { name: "Atlas", logo: ATLAS_LOGO.src },
  { name: "FluidTokens", logo: FLUIDTOKENS_LOGO.src },
  { name: "Atrium", logo: ATRIUM_LOGO.src },
  { name: "Surf", logo: SURF_LOGO.src },
  { name: "Minswap", logo: MINSWAP_LOGO.src },
];

export const ProtocolsSection = () => (
  <Section>
    <div className="shell">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <div>
          <SectionIntro
            align="left"
            heading={
              <>
                Integrations with top protocols
                <br />
                across <span className="text-sheen--cardano">Cardano</span>
              </>
            }
          />

          {/* Logos sit in the same circular chips the landing page uses for
              its /defi marquee. */}
          <div
            data-reveal
            style={{ "--reveal-delay": "0.07s" } as CSSProperties}
            className="flex flex-wrap gap-4"
          >
            {PROTOCOLS.map((protocol) => (
              <div
                key={protocol.name}
                title={protocol.name}
                className="grid h-[88px] shrink-0 place-items-center rounded-[26px] bg-[#0a0a0c] px-9 shadow-[0_10px_28px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.07)] transition-opacity hover:opacity-100"
              >
                {/* These are 3:1-to-7:1 wordmarks, so the tile is sized to the
                    art rather than a circle that would crop it. */}
                <img
                  src={protocol.logo}
                  alt={protocol.name}
                  className="h-11 w-auto max-w-[230px] object-contain opacity-90"
                />
              </div>
            ))}
          </div>
        </div>

        <div
          data-reveal
          style={{ "--reveal-delay": "0.1s" } as CSSProperties}
          className="flex justify-center lg:justify-end"
        >
          <img
            src={FLAME_GRAPHIC.src}
            alt=""
            aria-hidden="true"
            className="w-full max-w-md animate-float"
          />
        </div>
      </div>
    </div>
  </Section>
);
