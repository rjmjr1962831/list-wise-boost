/**
 * Non-AZ/CA state slugs (e.g. /texas, /colorado): noindex, redirect to homepage.
 * Only arizona and california are in sitemaps and indexable.
 */
import { Navigate, useParams } from "react-router-dom";
import { SafeHead } from "@/components/SafeHead";
import NotFound from "@/pages/NotFound";

const INDEXABLE_STATES = ['arizona', 'california'];

/** Paths that are NOT state slugs - let them 404 instead of redirecting */
const RESERVED_FIRST_SEGMENTS = new Set([
  'q', 'about', 'admin', 'faq', 'press', 'join', 'artifact', 'agent', 'profile',
  'visibility', 'coming-soon', 'albuquerque', 'migrate-data', 'clean-room',
  'privacy', 'terms', 'opt-in', 'transparency', 'for-ai', 'check-profile',
  'apply-listing', 'verify-listing', 'staging', 'badge', 'crm', 'og-preview',
]);

export default function StateNoindexRedirect() {
  const { stateSlug } = useParams<{ stateSlug: string }>();
  const normalized = (stateSlug || '').toLowerCase();

  if (INDEXABLE_STATES.includes(normalized)) {
    return <Navigate to="/" replace />;
  }
  if (RESERVED_FIRST_SEGMENTS.has(normalized)) {
    return <NotFound />;
  }

  return (
    <>
      <SafeHead>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>
      <Navigate to="/" replace />
    </>
  );
}
