/**
 * Runtime gate for admin routes. Block only production hosts.
 * Use minimal shell so /admin always renders; full dashboard loads on click so we can catch and show the exact error if it throws.
 */
import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { AdminMinimalShell } from "./AdminMinimalShell";

function isProductionHost(hostname: string): boolean {
  return hostname === "top10lists.us" || hostname === "www.top10lists.us";
}

export function AdminOr404() {
  const [allow, setAllow] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.location?.hostname != null) {
        setAllow(!isProductionHost(window.location.hostname));
      } else {
        setAllow(true);
      }
    } catch (_) {
      setAllow(true);
    }
  }, []);

  if (allow === null) {
    return <div className="min-h-[200px] flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!allow) {
    return <Navigate to="/404" replace />;
  }
  return <AdminMinimalShell />;
}
