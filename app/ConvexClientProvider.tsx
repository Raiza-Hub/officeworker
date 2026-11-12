"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache/provider";
import { LazyMotion, domMax } from "motion/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      <LazyMotion features={domMax} strict>
        <ConvexQueryCacheProvider expiration={5 * 60 * 1000}>
          {children}
        </ConvexQueryCacheProvider>
      </LazyMotion>
    </ConvexAuthNextjsProvider>
  );
}
