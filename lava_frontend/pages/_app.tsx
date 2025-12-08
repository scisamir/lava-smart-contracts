import "../src/index.css";
import type { AppProps } from "next/app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { MeshProvider } from "@meshsdk/react";
import { useRouter } from "next/router";
import appBg from "@/assets/app-bg.png";

const queryClient = new QueryClient();

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isIndex = router.pathname === "/";

  return (
    <QueryClientProvider client={queryClient}>
      <MeshProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {isIndex ? (
            <Component {...pageProps} />
          ) : (
            <div
              style={{
                backgroundImage: `url(${appBg.src})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: "cover",
                backgroundPosition: "center",
                minHeight: "100vh",
              }}
            >
              <Component {...pageProps} />
            </div>
          )}
        </TooltipProvider>
      </MeshProvider>
    </QueryClientProvider>
  );
}
