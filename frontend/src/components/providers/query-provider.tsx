"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { GC_TIME_MS, STALE_LIST_MS } from "@/lib/query-config";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: STALE_LIST_MS,
            gcTime: GC_TIME_MS,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const hideDevtools =
    process.env.NODE_ENV !== "development" || pathname?.startsWith("/api/tiphone");

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {!hideDevtools ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}
