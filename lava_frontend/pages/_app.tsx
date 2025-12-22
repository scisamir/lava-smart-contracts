import "../src/index.css";
import type { AppProps } from "next/app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { MeshProvider } from "@meshsdk/react";
import { useRouter } from "next/router";
import { ToastContainer } from "react-toastify";

const queryClient = new QueryClient();

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isIndex = router.pathname === "/";

  return (
    <QueryClientProvider client={queryClient}>
      <MeshProvider>
        <TooltipProvider>
          {/* Toast */}
				  <ToastContainer position='bottom-left' autoClose={5000} />
          <Toaster />
          <Sonner />
          <Component {...pageProps} />
        </TooltipProvider>
      </MeshProvider>
    </QueryClientProvider>
  );
}
