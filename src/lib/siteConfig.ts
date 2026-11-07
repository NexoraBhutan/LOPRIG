"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface SiteConfig {
  payments_enabled: boolean;
  /** Empty when "Continue with Google" isn't set up. */
  google_client_id?: string;
}

let request: Promise<SiteConfig> | null = null;

/** Public switches from the API (fetched once per page load). null while loading or unreachable. */
export function useSiteConfig(): SiteConfig | null {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  useEffect(() => {
    request ??= api<SiteConfig>("/config/").catch((err) => {
      request = null; // try again next time
      throw err;
    });
    let alive = true;
    request.then((c) => alive && setConfig(c)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return config;
}
