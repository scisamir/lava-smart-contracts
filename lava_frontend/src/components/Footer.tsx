import Link from "next/link";
import { LavaWordmark } from "./brand/LadaMark";

/* Ported from the landing page footer: ink fading into ember, the link
   columns on the right, and the oversized wordmark bleeding off the bottom. */

const COLUMNS: { head: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    head: "Protocol",
    links: [
      { label: "Stake", href: "/stake" },
      { label: "Earn", href: "/earn" },
      { label: "Portfolio", href: "/portfolio" },
      { label: "Points", href: "/points" },
    ],
  },
  {
    head: "Socials",
    links: [
      { label: "Twitter", href: "https://x.com/lava", external: true },
      { label: "Discord", href: "https://x.com/lava", external: true },
    ],
  },
];

const Footer = () => (
  <footer
    className="relative z-[1] overflow-hidden pt-[clamp(40px,6vw,72px)]"
    style={{ background: "linear-gradient(180deg, #05070a 0%, #12080a 42%, #2a1010 100%)" }}
  >
    <div className="shell relative z-[2] flex flex-col justify-between gap-10 pb-[clamp(48px,10vw,120px)] md:flex-row">
      <div>
        <LavaWordmark />
        <p className="mt-[10px] text-[13px] text-dim">
          © {new Date().getFullYear()} Lava. All rights reserved.
        </p>
      </div>

      <div className="flex gap-[clamp(40px,8vw,96px)]">
        {COLUMNS.map((col) => (
          <div key={col.head} className="flex min-w-[90px] flex-col gap-2">
            <span className="text-[14px] font-semibold">{col.head}</span>
            {col.links.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-dim transition-colors hover:text-white"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-[13px] text-dim transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              )
            )}
          </div>
        ))}
      </div>
    </div>

    <p
      aria-hidden="true"
      className="pointer-events-none relative z-[1] m-0 select-none text-center font-semibold"
      style={{
        fontSize: "clamp(120px, 28vw, 380px)",
        lineHeight: 0.78,
        letterSpacing: "-0.07em",
        color: "rgba(255, 154, 77, 0.22)",
        transform: "translateY(18%)",
      }}
    >
      lava
    </p>
  </footer>
);

export default Footer;
