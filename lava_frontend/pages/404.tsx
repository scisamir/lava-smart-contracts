import { useEffect } from "react";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { HeroGlow } from "@/components/home/HeroGlow";
import { Slug } from "@/components/layout/Section";

const NotFound = () => {
  useEffect(() => {
    if (typeof window !== "undefined") {
      console.error("404 Error: User attempted to access non-existent route:", window.location.pathname);
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navigation />

      <main className="relative isolate flex flex-1 items-center overflow-hidden py-[164px]">
        <HeroGlow />

        <div className="shell relative z-10 flex flex-col items-center gap-6 text-center">
          <Slug>/404</Slug>
          <h1 className="text-[clamp(56px,10vw,120px)] font-medium leading-none tracking-tightest">
            <span className="text-sheen">Lost</span> the thread
          </h1>
          <p className="max-w-[44ch] text-[16px] leading-[1.55] tracking-tighter text-dim">
            That page doesn&rsquo;t exist. Head back to the app and pick up where you left off.
          </p>
          <Link href="/" className="lava-pill mt-2">
            Back to Lava <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default NotFound;
