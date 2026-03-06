/**
 * GET /api/export-arizona-leads
 * Returns CSV: Firstname, Lastname, Email, Phone, Lead Status, Magic Link.
 * Filters: Arizona only, active only. No unsubscribe_url.
 * Auth: query param token must match EXPORT_DOWNLOAD_TOKEN (set in Vercel for staging).
 */
import { createClient } from '@supabase/supabase-js';
import { requireSupabaseAdmin } from './_lib/requireEnv.js';

function escapeCsv(val) {
  if (val == null || val === '') return '';
  const s = String(val).replace(/"/g, '""');
  return /[,"\n\r]/.test(s) ? `"${s}"` : s;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }

  const token = req.query.token;
  const expected = process.env.EXPORT_DOWNLOAD_TOKEN;
  if (!expected || token !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { serviceRoleKey, supabaseUrl } = requireSupabaseAdmin();
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const all = [];
    const pageSize = 1000;
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from('professionals')
        .select('id, name, email, phone, lead_status, verification_token')
        .eq('state_slug', 'arizona')
        .eq('active', true)
        .order('id')
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      if (!data?.length) break;
      all.push(...data);
      if (data.length < pageSize) break;
      offset += pageSize;
    }

    const header = ['Firstname', 'Lastname', 'Email', 'Phone', 'Lead Status', 'Magic Link'];
    const lines = [header.map(escapeCsv).join(',')];
    for (const p of all) {
      const name = p.name ?? '';
      const parts = name.trim().split(/\s+/);
      const firstname = parts[0] ?? '';
      const lastname = parts.slice(1).join(' ') ?? '';
      const email = p.email ?? '';
      const phone = p.phone ?? '';
      const leadStatus = p.lead_status ?? '';
      const magicLink = p.verification_token
        ? `https://www.top10lists.us/dashboard/${p.verification_token}`
        : '';
      lines.push([firstname, lastname, email, phone, leadStatus, magicLink].map(escapeCsv).join(','));
    }

    const csv = lines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="arizona-active-leads.csv"');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(csv);
  } catch (e) {
    console.error('export-arizona-leads:', e);
    return res.status(500).json({ error: e.message || 'Export failed' });
  }
}
