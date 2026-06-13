"use client";

import { useEffect } from "react";
import { setGlobalTheme } from "@atlaskit/tokens";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    setGlobalTheme({ colorMode: "light" });
  }, []);

  return <>{children}</>;
}
