import "../src/index.css";
import type { AppProps } from "next/app";
import { QueryClient } from "@tanstack/react-query";
import type { Query } from "@tanstack/react-query";
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
import { networkConfig } from "@/lib/networkConfig";
import { useRouter } from "next/router";
import { useReveal } from "@/hooks/useReveal";

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
        key: `lava-react-query-cache-v2:${networkConfig.name}`,
      })
    : noopPersister;

const shouldPersistQuery = (query: Query) =>
  query.queryKey[0] !== "wallet-balance";

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // Re-arms the [data-reveal] sweep whenever a new page mounts.
  useReveal([router.asPath]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: "exclude-wallet-balances",
        dehydrateOptions: {
          shouldDehydrateQuery: shouldPersistQuery,
        },
      }}
    >
      <MeshProvider>
        <CardanoWalletProvider>
          {/* REQUIRED FOR WALLET PERSISTENCE. Mounted but visually removed,
              the connect/disconnect UI lives in the nav; drop the wrapper to
              bring MeshSDK's own widget back. */}
          <div data-mesh-wallet-shim aria-hidden="true">
            <CardanoWallet />
          </div>

          <TooltipProvider>
            <ToastContainer position="bottom-left" autoClose={5000} theme="dark" />
            <Toaster />
            <Component {...pageProps} />
          </TooltipProvider>
        </CardanoWalletProvider>
      </MeshProvider>
    </PersistQueryClientProvider>
  );
}
