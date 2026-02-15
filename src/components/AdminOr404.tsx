/**
 * Runtime gate for admin routes: one build works for both staging and production.
 * - Staging host (staging.top10lists.us, *.vercel.app, localhost) → show admin app.
 * - Production host → redirect to /404 so admin is never exposed.
 * Admin chunk is lazy-loaded only when we're on a staging host.
 */
import React, { useState, useEffect, Suspense, lazy } from "react";
import { Navigate } from "react-router-dom";

const AdminAppLazy = lazy(() => import("@/AdminAppWrapper"));

function isStagingHost(hostname: string): boolean {
  return (
    hostname === "staging.top10lists.us" ||
    hostname.includes("staging") ||
    hostname.includes("vercel.app") ||
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  );
}

export function AdminOr404() {
  const [allow, setAllow] = useState<boolean | null>(null);

  useEffect(() => {
    setAllow(isStagingHost(window.location.hostname));
  }, []);

  if (allow === null) {
    return null;
  }
  if (!allow) {
    return <Navigate to="/404" replace />;
  }
  return (
    <Suspense fallback={null}>
      <AdminAppLazy />
    </Suspense>
  );
}
