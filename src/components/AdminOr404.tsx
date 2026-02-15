/**
 * Runtime gate for admin routes: one build works for both staging and production.
 * Block only known production hosts; allow everything else (staging, vercel.app, localhost).
 * Never return null so the route doesn't fall through to catch-all * (NotFound).
 */
import React, { useState, useEffect, Suspense, lazy } from "react";
import { Navigate } from "react-router-dom";

const AdminAppLazy = lazy(() => import("@/AdminAppWrapper"));

/** Only these hosts get 404 for /admin; all other hosts (staging, preview, localhost) get admin. */
function isProductionHost(hostname: string): boolean {
  return hostname === "top10lists.us" || hostname === "www.top10lists.us";
}

export function AdminOr404() {
  const [allow, setAllow] = useState<boolean | null>(null);

  useEffect(() => {
    setAllow(!isProductionHost(window.location.hostname));
  }, []);

  if (allow === null) {
    return <div className="min-h-[200px] flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!allow) {
    return <Navigate to="/404" replace />;
  }
  return (
    <Suspense fallback={<div className="min-h-[200px] flex items-center justify-center text-muted-foreground">Loading…</div>}>
      <AdminAppLazy />
    </Suspense>
  );
}
