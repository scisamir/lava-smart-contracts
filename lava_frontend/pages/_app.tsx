import "../src/index.css";
import type { AppProps } from "next/app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
//import { Sonner } from "@/components/ui/sonner";
import { MeshProvider, CardanoWallet } from "@meshsdk/react";  // Add CardanoWallet import
import { ToastContainer } from "react-toastify";

const queryClient = new QueryClient();

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <MeshProvider>
        <TooltipProvider>
          <ToastContainer position='bottom-left' autoClose={5000} />
          <Toaster />
          {/* Add CardanoWallet here for persistence across app */}
          
          <Component {...pageProps} />
        </TooltipProvider>
      </MeshProvider>
    </QueryClientProvider>
  );
}