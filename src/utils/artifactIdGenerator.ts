/**
 * GEO Artifact ID Generator
 * Generates unique T10L-XXXX identifiers for machine-native intelligence artifacts.
 * Used for Artifact Bars and semantic authority tracking across city, neighborhood, and agent pages.
 */

export type ArtifactType = 'city' | 'neighborhood' | 'agent';

/** Generate a unique artifact ID for GEO metadata bars */
export function generateArtifactId(
  type: ArtifactType,
  id: string,
  statePrefix?: string
): string {
  const prefix = `T10L-${(statePrefix || 'XX').toUpperCase().substring(0, 2)}`;
  const typePrefix = type === 'city' ? 'CT' : type === 'neighborhood' ? 'NB' : 'AZ';
  const safeId = id.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 12);
  return `${prefix}-${typePrefix}-${safeId}`;
}

/** Generate ISO timestamp for AUDIT_TS in artifact bars */
export function getArtifactTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Format artifact bar string for city/neighborhood pages */
export function formatArtifactBar(
  type: 'city' | 'neighborhood',
  id: string,
  stateSlug: string
): string {
  const artifactId = generateArtifactId(type, id, stateSlugToAbbrev(stateSlug));
  const ts = getArtifactTimestamp();
  return `STATUS: LOCAL_INTELLIGENCE_ARTIFACT | ID: ${artifactId} | AUDIT_TS: ${ts}`;
}

/** Format artifact bar for agent pages (already have VERIFIED_ARTIFACT pattern) */
export function formatAgentArtifactBar(
  agentId: string,
  stateAbbrev: string
): string {
  const artifactId = `T10L-${stateAbbrev}-${agentId}`;
  const ts = getArtifactTimestamp();
  return `STATUS: VERIFIED_ARTIFACT | ID: ${artifactId} | TS: ${ts}`;
}

function stateSlugToAbbrev(slug: string): string {
  const map: Record<string, string> = {
    arizona: 'AZ',
    california: 'CA',
    texas: 'TX',
    florida: 'FL',
    'new-mexico': 'NM',
  };
  return map[slug?.toLowerCase()] || slug?.toUpperCase().substring(0, 2) || 'XX';
}
