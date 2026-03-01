import "../src/index.css";
import type { AppProps } from "next/app";
import { QueryClient } from "@tanstack/react-query";
import {
  PersistQueryClientProvider,
  Persister,
} from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { MeshProvider, CardanoWallet } from "@meshsdk/react";
import { ToastContainer } from "react-toastify";
import { CardanoWalletProvider } from "@/hooks/useCardanoWallet";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const noopPersister: Persister = {
  persistClient: async () => {},
  restoreClient: async () => undefined,
  removeClient: async () => {},
};

const persister =
  typeof window !== "undefined"
    ? createSyncStoragePersister({
        storage: window.localStorage,
        key: "lava-react-query-cache-v1",
      })
    : noopPersister;

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000 }}
    >
      <MeshProvider>
        <CardanoWalletProvider>
          {/*REQUIRED FOR WALLET PERSISTENCE */}
          <CardanoWallet />

          <TooltipProvider>
            <ToastContainer position="bottom-left" autoClose={5000} />
            <Toaster />
            <Component {...pageProps} />
          </TooltipProvider>
        </CardanoWalletProvider>
      </MeshProvider>
    </PersistQueryClientProvider>
  );
}
