import * as React from "react";
import { cn } from "@/lib/utils";

/* The landing page's section rhythm: ink background, generous vertical
   padding that scales with the viewport, and a centred intro pair. */

export const Section = ({
  className,
  lip = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { lip?: boolean }) => (
  <section
    className={cn(
      "relative z-[1] bg-background py-[clamp(48px,7vw,96px)]",
      lip && "lava-section-lip",
      className,
    )}
    {...props}
  >
    {children}
  </section>
);

export const SectionIntro = ({
  heading,
  sub,
  align = "center",
  className,
}: {
  heading: React.ReactNode;
  sub?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) => (
  <div
    data-reveal
    className={cn(
      "mb-[clamp(28px,4vw,48px)]",
      align === "center" ? "text-center" : "text-left",
      className,
    )}
  >
    <h2 className="m-0 text-[clamp(32px,4.2vw,56px)] font-medium leading-[1.08] tracking-tightest">
      {heading}
    </h2>
    {sub && (
      <p className="mt-[10px] text-[clamp(16px,1.5vw,20px)] tracking-tighter text-dim">{sub}</p>
    )}
  </div>
);

/* The mono pill that labels a card on the landing page (`/mint`, `/earn`). */
export const Slug = ({ children }: { children: React.ReactNode }) => (
  <span className="lava-slug">{children}</span>
);

/* Page-level hero heading, used at the top of Stake / Earn / Vaults. */
export const PageHeading = ({
  eyebrow,
  title,
  children,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) => (
  <div
    data-reveal
    className={cn(align === "center" && "mx-auto text-center", className)}
  >
    {eyebrow && <Slug>{eyebrow}</Slug>}
    <h1
      className={cn(
        "text-[clamp(40px,6vw,72px)] font-medium leading-[1.02] tracking-tightest",
        eyebrow && "mt-5",
      )}
    >
      {title}
    </h1>
    {children && (
      <div
        className={cn(
          "mt-4 text-[clamp(15px,1.4vw,18px)] leading-[1.55] tracking-tighter text-dim",
          align === "center" ? "mx-auto max-w-[52ch]" : "max-w-[52ch]",
        )}
      >
        {children}
      </div>
    )}
  </div>
);

/* A labelled figure: the TVL / APY / Holders row and its cousins. */
export const Stat = ({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("min-w-0", className)}>
    <p className="font-mono-lava text-[11px] uppercase tracking-[0.02em] text-dim">{label}</p>
    <p className="tabular mt-2 text-[clamp(20px,2.4vw,34px)] font-medium leading-none tracking-tightest">
      {value}
    </p>
    {sub && <p className="mt-1 text-[13px] text-dim">{sub}</p>}
  </div>
);
