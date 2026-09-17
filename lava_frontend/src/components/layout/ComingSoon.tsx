import Link from "next/link";
import { LadaMark } from "@/components/brand/LadaMark";
import { Slug } from "@/components/layout/Section";

/* Placeholder for a route that is routed and navigable but not yet built.
   Same ink, ember glow and typography as the rest of the app, so it reads as
   an unfinished part of the product rather than an error page. */
export const ComingSoon = ({
  slug,
  title,
  children,
}: {
  slug: string;
  title: React.ReactNode;
  children?: React.ReactNode;
}) => (
  <section className="relative isolate flex min-h-[calc(100svh-68px)] items-center overflow-hidden py-[clamp(64px,10vw,120px)]">
    {/* The hero glow, dialled down. */}
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-x-0 top-0 h-[70vh] bg-[radial-gradient(50%_44%_at_50%_20%,rgba(223,71,61,0.16),transparent_70%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[40vh] bg-gradient-to-b from-transparent to-background" />
    </div>

    <div className="shell">
      <div className="mx-auto flex max-w-[560px] flex-col items-center text-center">
        <div data-reveal className="flex flex-col items-center">
          <LadaMark className="h-10 w-10 text-lava-ember" />
          <div className="mt-6">
            <Slug>{slug}</Slug>
          </div>
          <h1 className="mt-5 text-[clamp(36px,5vw,60px)] font-medium leading-[1.05] tracking-tightest">
            {title}
          </h1>
          <p className="mt-4 max-w-[44ch] text-[clamp(15px,1.4vw,18px)] leading-[1.55] tracking-tighter text-dim">
            {children}
          </p>
        </div>

        <div
          data-reveal
          style={{ ["--reveal-delay" as string]: "0.07s" }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <span className="lava-slug">Coming soon</span>
          <Link href="/stake" className="lava-pill lava-pill--sm">
            Stake instead <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </div>
  </section>
);

export default ComingSoon;
