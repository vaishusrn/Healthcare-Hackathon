import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 5000,
      staleTime: 4000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
