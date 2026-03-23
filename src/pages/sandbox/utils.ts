import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

/** Returns '/sandbox' or '/funnel' based on current URL */
export function useBasePath(): string {
  const { pathname } = useLocation();
  return pathname.startsWith('/funnel') ? '/funnel' : '/sandbox';
}

const PROFESSIONAL_SELECT = `*, cities:city_id (id, name, state, state_slug, slug), categories:category_id (id, name, slug)`;

export async function validateToken(token: string) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);

  let { data, error } = await supabase
    .from('professionals')
    .select(PROFESSIONAL_SELECT)
    .eq('verification_token', token)
    .maybeSingle();

  let lookedUpById = false;

  if (!data && !error && isUUID) {
    const fallback = await supabase
      .from('professionals')
      .select(PROFESSIONAL_SELECT)
      .eq('id', token)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
    lookedUpById = !!data;
  }

  if (error || !data) return { status: 'invalid' as const, professional: null };

  if (!lookedUpById) {
    const expiresAt = data.verification_token_expires_at;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return { status: 'expired' as const, professional: null };
    }
  }

  if (!data.active) return { status: 'invalid' as const, professional: null };

  return { status: 'valid' as const, professional: data };
}

export function getStateFromProfessional(professional: any): { stateSlug: string; stateName: string } {
  const slug = professional.cities?.state_slug || professional.state_slug || 'arizona';
  const nameMap: Record<string, string> = { arizona: 'Arizona', california: 'California' };
  return { stateSlug: slug, stateName: nameMap[slug] || slug };
}

export function getTotalAnalyzed(stateSlug: string): string {
  if (stateSlug === 'california') return '450,000+';
  return '220,000+';
}
