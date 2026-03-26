/**
 * SandboxStep2Accordion — Single-page accordion combining Contact + Cities + Neighborhoods.
 * Replaces Steps 2, 3, and 4 with one page, three collapsible sections.
 * Each section auto-saves. User expands sections in order, or jumps around.
 * Continue button only enables when all three sections have data.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SafeHead } from '@/components/SafeHead';
import { supabase } from '@/integrations/supabase/client';
import { BundlesPanel, type CityBundle } from '@/components/visibility/BundlesPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Check, ChevronDown, ChevronUp, Search, X, Plus, MapPin, Phone, Mail, Globe, Building } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useGA4Tracking } from '@/hooks/useGA4Tracking';
import { REGIONAL_PACKAGES } from '@/data/arizonaPackages';
import { CALIFORNIA_PACKAGES, CA_CATEGORY_LABELS, CA_CATEGORY_ORDER } from '@/data/californiaPackages';
import { RevenueGapBanner } from '@/components/funnel/RevenueGapBanner';
import { SandboxNugget } from './SandboxNugget';
import { SandboxProgress } from './SandboxProgress';
import { validateToken, getStateFromProfessional, useBasePath } from './utils';

/* ── Shared helpers ────────────────────────────────────────────────── */
function formatUSPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (d.length !== 10) return raw;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function PublishToggle({ publish, onToggle }: { publish: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Public</span>
      <button
        type="button"
        role="switch"
        aria-checked={publish}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${publish ? 'bg-primary' : 'bg-muted-foreground/30'}`}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${publish ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
      <span className={`text-xs font-medium w-6 ${publish ? 'text-primary' : 'text-muted-foreground'}`}>
        {publish ? 'Yes' : 'No'}
      </span>
    </div>
  );
}

function SavedIndicator({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-600 animate-in fade-in duration-300">
      <Check className="h-3 w-3" /> Saved
    </span>
  );
}

interface Neighborhood {
  id: string;
  neighborhood: string;
  neighborhood_slug: string;
  city_area: string;
  city_area_slug: string;
  state: string;
  nearby_neighborhoods?: string | null;
}

interface NearbyItem {
  id: string;
  name: string;
  city: string;
  distance_miles: number | null;
}

function parseNearbyField(raw: string | null | undefined): { isJson: boolean; items: NearbyItem[]; textPairs: { name: string; city: string }[] } {
  if (!raw) return { isJson: false, items: [], textPairs: [] };
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const items: NearbyItem[] = parsed.map((p: any) => ({
        id: p.id, name: p.name || p.neighborhood || '', city: p.city || p.city_slug || '', distance_miles: p.distance_miles ?? null,
      }));
      return { isJson: true, items, textPairs: [] };
    } catch { /* fall through */ }
  }
  const pairs = trimmed.split(';').map(s => s.trim()).filter(Boolean);
  const textPairs = pairs.map(pair => {
    const lastComma = pair.lastIndexOf(',');
    if (lastComma === -1) return { name: pair, city: '' };
    return { name: pair.slice(0, lastComma).trim(), city: pair.slice(lastComma + 1).trim() };
  });
  return { isJson: false, items: [], textPairs };
}

/* ── Accordion Section wrapper ─────────────────────────────────────── */
function AccordionSection({ title, icon: Icon, badge, open, onToggle, complete, children }: {
  title: string;
  icon: any;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  complete: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('border rounded-lg transition-all', open ? 'border-primary shadow-sm' : complete ? 'border-green-300 bg-green-50/30' : 'border-border')}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={cn('flex items-center justify-center h-8 w-8 rounded-full', complete ? 'bg-green-100 text-green-600' : open ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
            {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
          </div>
          <div>
            <span className="font-semibold text-sm">{title}</span>
            {badge && <span className="ml-2 text-xs text-muted-foreground">{badge}</span>}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t animate-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────── */
export default function SandboxStep2Accordion() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const basePath = useBasePath();
  const { trackEvent } = useGA4Tracking();

  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<any>(null);
  const [openSection, setOpenSection] = useState<'contact' | 'cities' | 'neighborhoods'>('contact');

  // ── Contact state ──
  const [formData, setFormData] = useState({
    email: '', email_publish: true,
    phone_mobile: '', phone_mobile_publish: true,
    phone_business: '', phone_business_publish: true,
    phone_other: '', phone_other_publish: false,
    website: '', website_publish: true,
  });
  const [consent, setConsent] = useState(false);
  const [savedFields, setSavedFields] = useState<Set<string>>(new Set());
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const dbSnapshot = useRef<typeof formData | null>(null);

  // ── Cities state ──
  const [bundles, setBundles] = useState<CityBundle[]>([]);
  const [selectedCityIds, setSelectedCityIds] = useState<Set<string>>(new Set());
  const [catLabels, setCatLabels] = useState<Record<string, string> | undefined>();
  const [catOrder, setCatOrder] = useState<string[] | undefined>();
  const [cityNameMap, setCityNameMap] = useState<Map<string, string>>(new Map());

  // ── Neighborhoods state ──
  const [agentState, setAgentState] = useState<string | null>(null);
  const [allowedCityNames, setAllowedCityNames] = useState<string[]>([]);
  const [nhQuery, setNhQuery] = useState('');
  const [nhSuggestions, setNhSuggestions] = useState<Neighborhood[]>([]);
  const [isNhSearching, setIsNhSearching] = useState(false);
  const [selectedNhs, setSelectedNhs] = useState<Neighborhood[]>([]);
  const [nearbyItems, setNearbyItems] = useState<NearbyItem[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  /* ── Load everything on mount ────────────────────────────────────── */
  useEffect(() => {
    window.scrollTo(0, 0);
    if (!token) return;
    loadAll();
  }, [token]);

  const loadAll = async () => {
    const result = await validateToken(token!);
    if (result.status !== 'valid' || !result.professional) {
      navigate(`${basePath}/${token}`);
      return;
    }
    const p = result.professional;
    setProfessional(p);

    // Contact init
    const pn = p.phone_numbers as any;
    let mobile = '', mobilePub = true, business = '', businessPub = true, other = '', otherPub = false;
    if (pn) {
      if (pn.mobile?.number !== undefined) {
        mobile = pn.mobile?.number || ''; mobilePub = pn.mobile?.publish !== false;
        business = pn.business?.number || ''; businessPub = pn.business?.publish !== false;
        other = pn.other?.number || ''; otherPub = pn.other?.publish === true;
      } else { mobile = pn.cell || ''; business = pn.business || pn.brokerage || ''; }
    }
    if (!mobile && p.phone && p.phone !== 'N/A') mobile = p.phone;

    const initial = {
      email: p.email || '', email_publish: p.email_visible ?? true,
      phone_mobile: mobile, phone_mobile_publish: mobilePub,
      phone_business: business, phone_business_publish: businessPub,
      phone_other: other, phone_other_publish: otherPub,
      website: p.website || '', website_publish: p.website_visible ?? true,
    };
    setFormData(initial);
    dbSnapshot.current = { ...initial };

    // Cities init
    const { stateSlug, stateName } = getStateFromProfessional(p);
    setAgentState(stateName);
    if (p.city_id) setSelectedCityIds(new Set([p.city_id]));

    let cityOptions: any[] = [];
    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const { data: page } = await supabase.from('cities').select('id, name, slug, state_slug')
        .eq('active', true).eq('state_slug', stateSlug).order('name').range(offset, offset + pageSize - 1);
      if (!page || page.length === 0) break;
      cityOptions = cityOptions.concat(page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }
    const cityBySlug = new Map(cityOptions.map((c: any) => [c.slug, c.id]));
    const nameBySlug = new Map(cityOptions.map((c: any) => [c.slug, c.name]));
    const nameById = new Map(cityOptions.map((c: any) => [c.id, c.name]));
    setCityNameMap(nameById);

    if (stateSlug === 'arizona') {
      setBundles(REGIONAL_PACKAGES.map(pkg => ({
        id: pkg.id, name: pkg.name, description: pkg.description, category: pkg.category,
        cityIds: pkg.includedCityIds.map((s: string) => cityBySlug.get(s)).filter((id): id is string => !!id),
        cityNames: pkg.includedCityIds.map((s: string) => nameBySlug.get(s)).filter((n): n is string => !!n),
      })));
    } else if (stateSlug === 'california') {
      setBundles(CALIFORNIA_PACKAGES.map(pkg => ({
        id: pkg.id, name: pkg.name, description: pkg.description, category: pkg.category,
        cityIds: pkg.includedCityIds.map((s: string) => cityBySlug.get(s)).filter((id): id is string => !!id),
        cityNames: pkg.includedCityIds.map((s: string) => nameBySlug.get(s)).filter((n): n is string => !!n),
      })));
      setCatLabels(CA_CATEGORY_LABELS as Record<string, string>);
      setCatOrder(CA_CATEGORY_ORDER as string[]);
    }

    setLoading(false);
  };

  /* ── Contact: per-field save ─────────────────────────────────────── */
  const updateField = async (field: string, value: any) => {
    if (!token) return false;
    const { error } = await supabase.functions.invoke('update-professional-field', { body: { token, field, value } });
    return !error;
  };

  const saveField = useCallback(async (fieldKey: string, data: typeof formData) => {
    if (!professional || !token) return;
    const calls: Promise<boolean>[] = [];
    if (fieldKey === 'email' || fieldKey === 'email_publish') {
      calls.push(updateField('email', data.email), updateField('email_visible', data.email_publish));
    } else if (fieldKey.startsWith('phone_')) {
      calls.push(
        updateField('phone', data.phone_mobile || data.phone_business || data.phone_other || ''),
        updateField('phone_numbers', {
          mobile: { number: data.phone_mobile, publish: data.phone_mobile_publish },
          business: { number: data.phone_business, publish: data.phone_business_publish },
          other: { number: data.phone_other, publish: data.phone_other_publish },
        })
      );
    } else if (fieldKey === 'website' || fieldKey === 'website_publish') {
      calls.push(updateField('website', data.website), updateField('website_visible', data.website_publish));
    }
    if (calls.length === 0) return;
    const results = await Promise.all(calls);
    if (results.some(ok => !ok)) { toast.error(`Failed to save ${fieldKey}`); return; }
    if (dbSnapshot.current) dbSnapshot.current = { ...dbSnapshot.current, ...data };
    setSavedFields(prev => new Set(prev).add(fieldKey));
    if (savedTimers.current[fieldKey]) clearTimeout(savedTimers.current[fieldKey]);
    savedTimers.current[fieldKey] = setTimeout(() => {
      setSavedFields(prev => { const next = new Set(prev); next.delete(fieldKey); return next; });
    }, 2000);
  }, [professional]);

  const handleBlur = useCallback((fieldKey: string) => {
    if (!dbSnapshot.current) return;
    const snap = dbSnapshot.current as any;
    const current = formData as any;
    if (fieldKey.startsWith('phone_')) {
      const keys = ['phone_mobile', 'phone_mobile_publish', 'phone_business', 'phone_business_publish', 'phone_other', 'phone_other_publish'];
      if (keys.some(k => snap[k] !== current[k])) saveField(fieldKey, formData);
    } else if (snap[fieldKey] !== current[fieldKey]) {
      saveField(fieldKey, formData);
    }
  }, [formData, saveField]);

  const handleToggle = useCallback((fieldKey: string) => {
    setFormData(prev => {
      const next = { ...prev, [fieldKey]: !(prev as any)[fieldKey] };
      setTimeout(() => saveField(fieldKey, next), 0);
      return next;
    });
  }, [saveField]);

  /* ── Cities: handlers ────────────────────────────────────────────── */
  const handleAddBundle = (_bundleId: string, cityIds: string[]) => {
    setSelectedCityIds(prev => { const next = new Set(prev); cityIds.forEach(id => next.add(id)); return next; });
  };
  const handleToggleCity = (cityId: string) => {
    setSelectedCityIds(prev => { const next = new Set(prev); next.has(cityId) ? next.delete(cityId) : next.add(cityId); return next; });
  };

  // Update allowed city names when city selection changes
  useEffect(() => {
    const names = Array.from(selectedCityIds).map(id => cityNameMap.get(id)).filter((n): n is string => !!n);
    setAllowedCityNames(names);
  }, [selectedCityIds, cityNameMap]);

  /* ── Neighborhoods: search ───────────────────────────────────────── */
  useEffect(() => {
    if (nhQuery.length < 2 || !agentState) { setNhSuggestions([]); return; }
    const timer = setTimeout(async () => {
      setIsNhSearching(true);
      try {
        let q = supabase.from('neighborhood_catalog')
          .select('id, neighborhood, neighborhood_slug, city_area, city_area_slug, state, nearby_neighborhoods')
          .eq('state', agentState).eq('is_active', true).ilike('neighborhood', `%${nhQuery}%`).order('neighborhood').limit(15);
        if (allowedCityNames.length > 0) q = q.in('city_area', allowedCityNames);
        const { data } = await q;
        setNhSuggestions(data || []);
      } catch { setNhSuggestions([]); }
      finally { setIsNhSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [nhQuery, agentState, allowedCityNames]);

  const resolveNearbyFromText = useCallback(async (textPairs: { name: string; city: string }[], excludeIds: string[]) => {
    if (textPairs.length === 0) return;
    setNearbyLoading(true);
    try {
      const { data } = await supabase.from('neighborhood_catalog')
        .select('id, neighborhood, neighborhood_slug, city_area, city_area_slug')
        .eq('state', agentState!).eq('is_active', true).in('neighborhood', textPairs.map(p => p.name)).limit(50);
      if (data) {
        const matched: NearbyItem[] = [];
        for (const pair of textPairs) {
          const match = data.find(d => d.neighborhood === pair.name && d.city_area === pair.city && !excludeIds.includes(d.id) && (allowedCityNames.length === 0 || allowedCityNames.includes(d.city_area)));
          if (match) matched.push({ id: match.id, name: match.neighborhood, city: match.city_area, distance_miles: null });
        }
        setNearbyItems(matched);
      }
    } catch {} finally { setNearbyLoading(false); }
  }, [agentState, allowedCityNames]);

  const addNeighborhood = useCallback((n: Neighborhood) => {
    if (selectedNhs.some(s => s.id === n.id)) return;
    const nextList = [...selectedNhs, n];
    setSelectedNhs(nextList);
    const parsed = parseNearbyField(n.nearby_neighborhoods);
    const excludeIds = nextList.map(s => s.id);
    if (parsed.isJson) {
      setNearbyItems(parsed.items.filter(nb => !excludeIds.includes(nb.id) && (allowedCityNames.length === 0 || allowedCityNames.includes(nb.city))));
    } else if (parsed.textPairs.length > 0) {
      resolveNearbyFromText(parsed.textPairs, excludeIds);
    } else { setNearbyItems([]); }
    setNhQuery(''); setNhSuggestions([]);
  }, [selectedNhs, resolveNearbyFromText, allowedCityNames]);

  const addNearbyItem = useCallback((nb: NearbyItem) => {
    setSelectedNhs(prev => [...prev, { id: nb.id, neighborhood: nb.name, neighborhood_slug: '', city_area: nb.city, city_area_slug: '', state: agentState || '' }]);
    setNearbyItems(prev => prev.filter(item => item.id !== nb.id));
  }, [agentState]);

  /* ── Section completeness ────────────────────────────────────────── */
  const contactComplete = consent && !!(formData.email);
  const citiesComplete = selectedCityIds.size > 0;
  const neighborhoodsComplete = selectedNhs.length > 0;
  const allComplete = contactComplete && citiesComplete && neighborhoodsComplete;

  /* ── Continue ────────────────────────────────────────────────────── */
  const [saving, setSaving] = useState(false);
  const handleContinue = async () => {
    if (!allComplete || !professional || !token) return;
    setSaving(true);
    try {
      // Final save contact
      const primaryPhone = formData.phone_mobile || formData.phone_business || formData.phone_other || '';
      await Promise.all([
        updateField('email', formData.email), updateField('email_visible', formData.email_publish),
        updateField('phone', primaryPhone),
        updateField('phone_numbers', {
          mobile: { number: formData.phone_mobile, publish: formData.phone_mobile_publish },
          business: { number: formData.phone_business, publish: formData.phone_business_publish },
          other: { number: formData.phone_other, publish: formData.phone_other_publish },
        }),
        updateField('website', formData.website), updateField('website_visible', formData.website_publish),
      ]);

      // Save primary city
      const primaryCityId = (professional.city_id && selectedCityIds.has(professional.city_id)) ? professional.city_id : Array.from(selectedCityIds)[0];
      await supabase.functions.invoke('save-free-city-selection', { body: { professionalId: professional.id, cityId: primaryCityId } }).catch(() => {});

      // Notification
      await supabase.functions.invoke('send-funnel-notification', {
        body: { event_type: 'sandbox_contact_submitted', agent_name: professional.name, agent_email: formData.email, agent_id: professional.id },
      }).catch(() => {});

      trackEvent('sandbox_step2_accordion_complete', {
        professional_id: professional.id,
        city_count: selectedCityIds.size,
        neighborhood_count: selectedNhs.length,
      });

      navigate(`${basePath}/${token}/tier`, {
        state: { selectedCityIds: Array.from(selectedCityIds), selectedNeighborhoods: selectedNhs, professionalId: professional.id, professional },
      });
    } catch (err: any) {
      toast.error('Something went wrong: ' + (err.message || 'Please try again.'));
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <>
      <SafeHead>
        <title>Complete Your Profile | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <SandboxProgress currentStep={2} />

          <RevenueGapBanner professional={professional} />

          <SandboxNugget>
            <p className="mb-2">AI doesn't recommend whoever is LOUDEST. It names whoever is SAFEST. We were built to make AI feel safe naming you.</p>
            <p>Complete all three sections below, then choose your verification tier.</p>
          </SandboxNugget>

          {/* ═══ Section 1: Contact ═══ */}
          <AccordionSection
            title="Contact Information"
            icon={Mail}
            badge={contactComplete ? 'Complete' : undefined}
            open={openSection === 'contact'}
            onToggle={() => setOpenSection(openSection === 'contact' ? 'contact' : 'contact')}
            complete={contactComplete}
          >
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">How should people reach you? Each field saves automatically.</p>

              {/* Email */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email">Email Address</Label>
                  <SavedIndicator show={savedFields.has('email') || savedFields.has('email_publish')} />
                </div>
                <div className="flex items-center gap-3">
                  <Input id="email" type="email" value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    onBlur={() => handleBlur('email')} required className="flex-1" />
                  <PublishToggle publish={formData.email_publish} onToggle={() => handleToggle('email_publish')} />
                </div>
              </div>

              {/* Phones */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Phone Numbers</Label>
                  <SavedIndicator show={['phone_mobile', 'phone_business', 'phone_other'].some(k => savedFields.has(k))} />
                </div>
                {[
                  { label: 'Mobile', id: 'phone_mobile' as const, pub: 'phone_mobile_publish' as const },
                  { label: 'Business', id: 'phone_business' as const, pub: 'phone_business_publish' as const },
                  { label: 'Other', id: 'phone_other' as const, pub: 'phone_other_publish' as const },
                ].map(ph => (
                  <div key={ph.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <Label htmlFor={ph.id} className="text-xs text-muted-foreground">{ph.label}</Label>
                      <Input id={ph.id} type="tel" value={(formData as any)[ph.id]}
                        onChange={e => setFormData({ ...formData, [ph.id]: e.target.value })}
                        onBlur={() => { const f = formatUSPhone((formData as any)[ph.id]); if (f !== (formData as any)[ph.id]) setFormData(prev => ({ ...prev, [ph.id]: f })); handleBlur(ph.id); }}
                        placeholder="(555) 123-4567" />
                    </div>
                    <div className="mt-5">
                      <PublishToggle publish={(formData as any)[ph.pub]} onToggle={() => handleToggle(ph.pub)} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Website */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="website">Website</Label>
                  <SavedIndicator show={savedFields.has('website') || savedFields.has('website_publish')} />
                </div>
                <div className="flex items-center gap-3">
                  <Input id="website" type="url" value={formData.website}
                    onChange={e => setFormData({ ...formData, website: e.target.value })}
                    onBlur={() => handleBlur('website')} className="flex-1" />
                  <PublishToggle publish={formData.website_publish} onToggle={() => handleToggle('website_publish')} />
                </div>
              </div>

              {/* Consent */}
              <div className="flex items-start space-x-2 pt-2">
                <Checkbox id="consent" checked={consent} onCheckedChange={c => setConsent(!!c)} />
                <Label htmlFor="consent" className="text-sm font-normal leading-snug cursor-pointer">
                  I agree to the <a href="/terms" target="_blank" className="underline text-primary">Terms</a> and <a href="/privacy" target="_blank" className="underline text-primary">Privacy Policy</a>.
                </Label>
              </div>

              {contactComplete && (
                <Button size="sm" variant="outline" onClick={() => setOpenSection('cities')} className="mt-2">
                  Next: Select Cities <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          </AccordionSection>

          {/* ═══ Section 2: Cities ═══ */}
          <AccordionSection
            title="Cities"
            icon={Building}
            badge={citiesComplete ? `${selectedCityIds.size} selected` : undefined}
            open={openSection === 'cities'}
            onToggle={() => setOpenSection(openSection === 'cities' ? 'cities' : 'cities')}
            complete={citiesComplete}
          >
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                AI won't name you in a city unless it can verify you work there. Select cities where you have 2+ transactions in the last 12 months.
              </p>

              <BundlesPanel bundles={bundles} selectedCities={selectedCityIds} onAddBundle={handleAddBundle} onToggleCity={handleToggleCity} categoryLabels={catLabels} categoryOrder={catOrder} />

              <p className="text-sm text-muted-foreground">{selectedCityIds.size} {selectedCityIds.size === 1 ? 'city' : 'cities'} selected</p>

              {citiesComplete && (
                <Button size="sm" variant="outline" onClick={() => setOpenSection('neighborhoods')} className="mt-2">
                  Next: Select Neighborhoods <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          </AccordionSection>

          {/* ═══ Section 3: Neighborhoods ═══ */}
          <AccordionSection
            title="Neighborhoods"
            icon={MapPin}
            badge={neighborhoodsComplete ? `${selectedNhs.length} selected` : undefined}
            open={openSection === 'neighborhoods'}
            onToggle={() => setOpenSection(openSection === 'neighborhoods' ? 'neighborhoods' : 'neighborhoods')}
            complete={neighborhoodsComplete}
          >
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                AI searches neighborhoods 20x more than cities. Select areas where you've closed deals.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[300px]">
                {/* Search + Nearby */}
                <div className="flex flex-col border rounded-lg">
                  <div className="p-3 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search neighborhoods..." value={nhQuery} onChange={e => setNhQuery(e.target.value)} className="pl-9" />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 max-h-[280px]">
                    {nhQuery.length >= 2 && (
                      <>
                        {isNhSearching && <p className="text-sm text-muted-foreground">Searching...</p>}
                        {!isNhSearching && nhSuggestions.length === 0 && <p className="text-sm text-muted-foreground">No matches{allowedCityNames.length > 0 ? ' in selected cities' : ''}</p>}
                        {!isNhSearching && nhSuggestions.length > 0 && (
                          <ul className="space-y-1 mb-4">
                            {nhSuggestions.map(n => {
                              const added = selectedNhs.some(s => s.id === n.id);
                              return (
                                <li key={n.id} className={cn('px-3 py-2 rounded cursor-pointer text-sm', added ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'hover:bg-muted')} onClick={() => !added && addNeighborhood(n)}>
                                  <span className="font-medium">{n.neighborhood}</span>
                                  <span className="text-muted-foreground ml-1">({n.city_area})</span>
                                  {added && <span className="text-emerald-500 ml-2 text-xs">Added</span>}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </>
                    )}
                    {nhQuery.length < 2 && (nearbyItems.length > 0 || nearbyLoading) && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <MapPin className="h-4 w-4 text-primary" />
                          <p className="text-sm font-medium">You might also want:</p>
                        </div>
                        {nearbyLoading ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Finding nearby...</div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {nearbyItems.filter(nb => !selectedNhs.some(s => s.id === nb.id)).map(nb => (
                              <button key={nb.id} onClick={() => addNearbyItem(nb)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border text-sm hover:bg-primary/10 hover:border-primary/30 transition-colors">
                                {nb.name} {nb.distance_miles != null && <span className="text-muted-foreground text-xs">{nb.distance_miles.toFixed(1)}mi</span>}
                                <Plus className="h-3 w-3 text-primary" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {nhQuery.length < 2 && nearbyItems.length === 0 && !nearbyLoading && (
                      <div className="flex flex-col items-center justify-center h-full text-center py-6">
                        <Search className="h-6 w-6 text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">{selectedCityIds.size === 0 ? 'Select cities first' : 'Search neighborhoods'}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected */}
                <div className="flex flex-col border rounded-lg">
                  <div className="p-3 border-b font-medium text-sm">Selected ({selectedNhs.length})</div>
                  <div className="flex-1 overflow-y-auto p-3 max-h-[280px]">
                    {selectedNhs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center py-6">
                        <MapPin className="h-6 w-6 text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">No neighborhoods yet</p>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {selectedNhs.map(n => (
                          <li key={n.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-muted border">
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-medium block truncate">{n.neighborhood}</span>
                              <span className="text-xs text-muted-foreground">{n.city_area}</span>
                            </div>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => setSelectedNhs(prev => prev.filter(x => x.id !== n.id))}>
                              <X className="h-4 w-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">{selectedNhs.length} {selectedNhs.length === 1 ? 'neighborhood' : 'neighborhoods'} selected</p>
            </div>
          </AccordionSection>

          {/* ═══ Continue ═══ */}
          <div className="flex justify-between pt-4">
            <Button variant="ghost" onClick={() => navigate(`${basePath}/${token}`)}>Back</Button>
            <Button onClick={handleContinue} disabled={!allComplete || saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : 'Choose Your Tier'}
            </Button>
          </div>

          {!allComplete && (
            <p className="text-xs text-center text-muted-foreground">
              Complete all three sections to continue.
              {!contactComplete && ' Missing: contact info.'}
              {!citiesComplete && ' Missing: city selection.'}
              {!neighborhoodsComplete && ' Missing: neighborhoods.'}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
