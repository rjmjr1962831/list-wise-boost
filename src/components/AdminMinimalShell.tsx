/**
 * Minimal admin shell that always renders. Loads real admin only after user clicks.
 * If the real admin throws, AdminErrorCatcher shows the exact error so we can fix it.
 */
import React, { useState, Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import { AdminErrorCatcher } from "./AdminErrorCatcher";

const AdminAppLazy = lazy(() => import("@/AdminAppWrapper"));

export function AdminMinimalShell() {
  const [loadFull, setLoadFull] = useState(false);

  if (!loadFull) {
    return (
      <div className="min-h-screen bg-background p-6 font-sans">
        <h1 className="text-2xl font-bold mb-2">Admin</h1>
        <p className="text-muted-foreground mb-4">Staging / preview only.</p>
        <div className="flex flex-col gap-2">
          <Link to="/admin/login" className="text-primary underline font-medium">
            Admin login
          </Link>
          <button
            type="button"
            className="px-4 py-2 rounded border border-border hover:bg-accent w-fit"
            onClick={() => setLoadFull(true)}
          >
            Load full admin dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminErrorCatcher>
      <Suspense fallback={<div className="min-h-[200px] flex items-center justify-center p-6">Loading dashboard…</div>}>
        <AdminAppLazy />
      </Suspense>
    </AdminErrorCatcher>
  );
}
