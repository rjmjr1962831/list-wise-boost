import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight, ArrowLeft, HelpCircle, X, Plus, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { trackFunnelEvent } from '@/lib/funnel-track';
import InlineReviewForm from '@/components/funnel/InlineReviewForm';
import { floorSales, floorReviews } from '@/utils/floorDisplay';
import { FunnelBreadcrumbs } from '@/components/funnel/FunnelBreadcrumbs';
import { RevenueGapBanner } from '@/components/funnel/RevenueGapBanner';

// Known specialties for autocomplete - kept in sync with DB
const KNOWN_SPECIALTIES = [
  "Bilingual services", "Buyer's Agent", "Client satisfaction", "Commercial",
  "Commercial Real Estate", "Complex transactions", "Distressed properties",
  "First Time Homebuyers", "Foreclosure", "Foreclosure alternatives",
  "Hispanic community", "Investment Properties", "Investment Sales",
  "Land", "Land Sales", "Listing Agent", "Luxury Homes", "Manufactured Homes",
  "Market guidance", "Military/Veterans", "Negotiation", "New Construction",
  "Personalized service", "Property Management", "Ranch Properties", "Relocation",
  "Rentals", "Residential", "Residential resale", "Rural Properties",
  "Senior Communities", "Short sales", "Single Family Residence", "Staging",
  "Buyer representation", "Cash transactions", "Client advocacy",
  "Client communication", "Diverse property types", "First-time buyers",
  "Integrity", "Investing", "Investors", "Market education", "Market expertise",
  "Marketing", "Negotiation skills", "Professionalism", "Real estate investment",
  "Relationship building", "Responsive service", "Sales and marketing",
  "Seller representation", "Transparent communication",
  "Wealth building through real estate",
];

interface Professional {
  id: string;
  name: string;
  email: string | null;
  title: string | null;
  headline: string | null;
  company: string | null;
  business_name: string | null;
  website: string | null;
  license_number: string | null;
  years_experience: number | null;
  total_sales: number | null;
  specialty: string[] | null;
  zillow_profile_url: string | null;
  sidebar_video_url: string | null;
  review_stars_rating: number | null;
  num_total_reviews: number | null;
  social_facebook: string | null;
  social_instagram: string | null;
  social_linkedin: string | null;
  social_twitter: string | null;
  social_tiktok: string | null;
  image_url: string | null;
  agent_sales_stats?: { volumeAllTime?: number; countAllTime?: number; countLastYear?: number } | null;
  average_value_3yr?: number | null;
}

export default function Step3Review2() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [allSpecialties, setAllSpecialties] = useState<string[]>(KNOWN_SPECIALTIES);
  const [specialtyInput, setSpecialtyInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [reviewField, setReviewField] = useState<string | null>(null);
  const [submittedReviews, setSubmittedReviews] = useState<Set<string>>(new Set());
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    website: '',
    title: '',
    zillow_profile_url: '',
    sidebar_video_url: '',
    social_facebook: '',
    social_instagram: '',
    social_linkedin: '',
    social_twitter: '',
    social_tiktok: '',
    business_name: '',
  });

  useEffect(() => {
    loadProfessional();
    loadAllSpecialties();
  }, [token]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadAllSpecialties = async () => {
    try {
      // Fetch unique specialties from all professionals
      const { data } = await supabase
        .from('professionals')
        .select('specialty')
        .not('specialty', 'is', null)
        .limit(500);

      if (data) {
        const uniqueSpecs = new Set<string>(KNOWN_SPECIALTIES);
        for (const row of data) {
          if (Array.isArray(row.specialty)) {
            for (const s of row.specialty) {
              if (s && typeof s === 'string') uniqueSpecs.add(s);
            }
          }
        }
        setAllSpecialties(Array.from(uniqueSpecs).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
      }
    } catch {
      // Fall back to KNOWN_SPECIALTIES
    }
  };

  const loadProfessional = async () => {
    if (!token) {
      navigate('/404');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('professionals')
        .select('id, name, email, title, headline, company, business_name, website, license_number, years_experience, total_sales, specialty, zillow_profile_url, sidebar_video_url, review_stars_rating, num_total_reviews, social_facebook, social_instagram, social_linkedin, social_twitter, social_tiktok, image_url, agent_sales_stats, average_value_3yr')
        .eq('verification_token', token)
        .single();

      if (error || !data) {
        navigate('/404');
        return;
      }

      setProfessional(data);
      trackFunnelEvent('funnel_step_review2', data);
      setSelectedSpecialties(Array.isArray(data.specialty) ? data.specialty : []);
      setFormData({
        website: data.website || '',
        title: data.title || '',
        zillow_profile_url: data.zillow_profile_url || '',
        sidebar_video_url: data.sidebar_video_url || '',
        social_facebook: data.social_facebook || '',
        social_instagram: data.social_instagram || '',
        social_linkedin: data.social_linkedin || '',
        social_twitter: data.social_twitter || '',
        social_tiktok: data.social_tiktok || '',
        business_name: data.business_name || '',
      });
    } catch (err) {
      navigate('/404');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!professional) return;
    trackFunnelEvent('funnel_data_saved', professional);

    setSaving(true);
    try {
      const { error } = await supabase
        .from('professionals')
        .update({
          website: formData.website || null,
          title: formData.title || null,
          specialty: selectedSpecialties.length ? selectedSpecialties : null,
          zillow_profile_url: formData.zillow_profile_url || null,
          sidebar_video_url: formData.sidebar_video_url || null,
          social_facebook: formData.social_facebook || null,
          social_instagram: formData.social_instagram || null,
          social_linkedin: formData.social_linkedin || null,
          social_twitter: formData.social_twitter || null,
          social_tiktok: formData.social_tiktok || null,
          business_name: formData.business_name || null,
        })
        .eq('id', professional.id);

      if (error) throw error;

      toast.success('Professional details saved!');
      navigate(`/funnel/${token}/review-final`);
    } catch (err: any) {
      toast.error('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Review requests handled by InlineReviewForm component

  const getVolume = () => {
    if (!professional) return null;
    const stats = professional.agent_sales_stats as { volumeAllTime?: number } | undefined;
    const v = stats?.volumeAllTime ?? professional.average_value_3yr;
    if (v == null || v <= 0) return null;
    if (v >= 1000000000) return `$${(v / 1000000000).toFixed(1)}B`;
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
    return `$${v.toLocaleString()}`;
  };

  const filteredSuggestions = specialtyInput.trim()
    ? allSpecialties.filter(
        (s) =>
          s.toLowerCase().includes(specialtyInput.toLowerCase()) &&
          !selectedSpecialties.some((sel) => sel.toLowerCase() === s.toLowerCase())
      )
    : [];

  const addSpecialty = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (selectedSpecialties.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return;
    setSelectedSpecialties([...selectedSpecialties, trimmed]);
    setSpecialtyInput('');
    setShowSuggestions(false);
  };

  const removeSpecialty = (index: number) => {
    setSelectedSpecialties(selectedSpecialties.filter((_, i) => i !== index));
  };

  const handleSpecialtyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredSuggestions.length > 0) {
        addSpecialty(filteredSuggestions[0]);
      } else if (specialtyInput.trim()) {
        addSpecialty(specialtyInput);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const stats = professional?.agent_sales_stats as { countAllTime?: number; countLastYear?: number } | undefined;
  const totalSalesDisplay = professional?.total_sales ?? stats?.countAllTime ?? stats?.countLastYear ?? null;

  return (
    <>
      <SafeHead>
        <title>Professional Details | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
      </SafeHead>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <RevenueGapBanner professional={professional} />
          <FunnelBreadcrumbs currentStep={4} />
          <Card className="!bg-white/5 border-white/10 mt-3">
            <CardHeader>
              <CardTitle className="text-white">Review your profile fields</CardTitle>
              <p className="text-sm text-slate-400">
                Fields you can edit are open inputs. Some fields require a review request to change. Your changes save when you continue.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {/* Read-only fields with Request Review */}
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-300">License Number</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white font-mono">
                      {professional?.license_number || 'Not provided'}
                    </div>
                    {submittedReviews.has('license_number') ? (
                      <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-md shrink-0">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Review requested
                      </div>
                    ) : reviewField !== 'license_number' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setReviewField('license_number')}
                        className="shrink-0 border-white/20 text-slate-300 hover:text-white hover:bg-white/10"
                      >
                        <HelpCircle className="h-4 w-4 mr-1" />
                        Request review
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500">To change your license number, request a review.</p>
                  {reviewField === 'license_number' && professional && (
                    <InlineReviewForm
                      fieldName="License Number"
                      currentValue={professional.license_number || ''}
                      professionalId={professional.id}
                      professionalName={professional.name}
                      professionalEmail={professional.email || undefined}
                      onSubmitted={() => { setSubmittedReviews(prev => new Set(prev).add('license_number')); setReviewField(null); }}
                      onClose={() => setReviewField(null)}
                    />
                  )}
                </div>

                {/* Reviews: read-only with request review */}
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-300">Reviews</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
                      {professional?.review_stars_rating ?? '—'} stars · {professional?.num_total_reviews != null ? (floorReviews(professional.num_total_reviews) ?? professional.num_total_reviews) : 0} reviews
                    </div>
                    {submittedReviews.has('reviews') ? (
                      <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-md shrink-0">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Review requested
                      </div>
                    ) : reviewField !== 'reviews' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setReviewField('reviews')}
                        className="shrink-0 border-white/20 text-slate-300 hover:text-white hover:bg-white/10"
                      >
                        <HelpCircle className="h-4 w-4 mr-1" />
                        Request review
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500">To change your review data, request a review.</p>
                  {reviewField === 'reviews' && professional && (
                    <InlineReviewForm
                      fieldName="Reviews"
                      currentValue={`${professional.review_stars_rating ?? '—'} stars, ${professional.num_total_reviews != null ? (floorReviews(professional.num_total_reviews) ?? professional.num_total_reviews) : 0} reviews`}
                      professionalId={professional.id}
                      professionalName={professional.name}
                      professionalEmail={professional.email || undefined}
                      onSubmitted={() => { setSubmittedReviews(prev => new Set(prev).add('reviews')); setReviewField(null); }}
                      onClose={() => setReviewField(null)}
                    />
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-slate-300">Years of Experience</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
                      {professional?.years_experience != null ? `${professional.years_experience} years` : 'Not provided'}
                    </div>
                    {submittedReviews.has('years_experience') ? (
                      <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-md shrink-0">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Review requested
                      </div>
                    ) : reviewField !== 'years_experience' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setReviewField('years_experience')}
                        className="shrink-0 border-white/20 text-slate-300 hover:text-white hover:bg-white/10"
                      >
                        <HelpCircle className="h-4 w-4 mr-1" />
                        Request review
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500">To change your years of experience, request a review.</p>
                  {reviewField === 'years_experience' && professional && (
                    <InlineReviewForm
                      fieldName="Years of Experience"
                      currentValue={professional.years_experience != null ? `${professional.years_experience}` : ''}
                      professionalId={professional.id}
                      professionalName={professional.name}
                      professionalEmail={professional.email || undefined}
                      onSubmitted={() => { setSubmittedReviews(prev => new Set(prev).add('years_experience')); setReviewField(null); }}
                      onClose={() => setReviewField(null)}
                    />
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-slate-300">Total Sales</Label>
                    <div className="relative group">
                      <button
                        type="button"
                        className="text-slate-500 hover:text-white"
                        onClick={(e) => {
                          const tip = e.currentTarget.nextElementSibling;
                          if (tip) tip.classList.toggle('hidden');
                        }}
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                      <div className="hidden absolute z-50 left-0 top-6 w-72 rounded-md border border-white/10 bg-slate-800 p-3 text-xs text-slate-300 shadow-md">
                        <p className="font-medium mb-1">Why the + sign?</p>
                        <p>AI systems see different numbers on different sites. If we published an exact count, any discrepancy would reduce AI trust in your profile. By showing a verified floor (e.g. 150+), the AI understands this is a minimum we stand behind, and that variation elsewhere is expected. This protects your citation score.</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
                      {totalSalesDisplay != null ? (floorSales(totalSalesDisplay) ?? `${totalSalesDisplay.toLocaleString()}+`) : 'Not provided'}
                    </div>
                    {submittedReviews.has('total_sales') ? (
                      <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-md shrink-0">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Review requested
                      </div>
                    ) : reviewField !== 'total_sales' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setReviewField('total_sales')}
                        className="shrink-0 border-white/20 text-slate-300 hover:text-white hover:bg-white/10"
                      >
                        <HelpCircle className="h-4 w-4 mr-1" />
                        Request review
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500">To change your total sales count, request a review.</p>
                  {reviewField === 'total_sales' && professional && (
                    <InlineReviewForm
                      fieldName="Total Sales"
                      currentValue={totalSalesDisplay != null ? `${totalSalesDisplay}` : ''}
                      professionalId={professional.id}
                      professionalName={professional.name}
                      professionalEmail={professional.email || undefined}
                      onSubmitted={() => { setSubmittedReviews(prev => new Set(prev).add('total_sales')); setReviewField(null); }}
                      onClose={() => setReviewField(null)}
                    />
                  )}
                </div>

                {/* Volume (read-only, display only) */}
                {getVolume() && (
                  <div>
                    <Label className="text-slate-300">Volume (3yr)</Label>
                    <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">{getVolume()}</div>
                  </div>
                )}

                {/* Editable fields */}
                <div>
                  <Label htmlFor="website">Website URL</Label>
                  <p className="text-xs text-slate-500 mb-1">You can edit this field directly.</p>
                  <Input
                    id="website"
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://yourwebsite.com"
                  />
                </div>

                <div>
                  <Label htmlFor="title">Title (e.g. REALTOR, Broker, CRS)</Label>
                  <p className="text-xs text-slate-500 mb-1">You can edit this field directly.</p>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Your professional title"
                  />
                </div>

                {/* Specialty autocomplete */}
                <div>
                  <Label className="text-slate-300">Specialties</Label>
                  <p className="text-xs text-slate-500 mb-2">Start typing to see suggestions, or enter your own. Press Enter or click to add.</p>

                  {/* Selected specialties as chips */}
                  {selectedSpecialties.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedSpecialties.map((spec, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-sm"
                        >
                          {spec}
                          <button
                            type="button"
                            onClick={() => removeSpecialty(i)}
                            className="hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Input with autocomplete */}
                  <div className="relative">
                    <div className="flex gap-2">
                      <Input
                        ref={inputRef}
                        value={specialtyInput}
                        onChange={(e) => {
                          setSpecialtyInput(e.target.value);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onKeyDown={handleSpecialtyKeyDown}
                        placeholder="Type a specialty..."
                      />
                      {specialtyInput.trim() && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addSpecialty(specialtyInput)}
                          className="shrink-0 border-white/20 text-slate-300 hover:text-white hover:bg-white/10"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      )}
                    </div>

                    {/* Suggestions dropdown */}
                    {showSuggestions && filteredSuggestions.length > 0 && (
                      <div
                        ref={suggestionsRef}
                        className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto"
                      >
                        {filteredSuggestions.slice(0, 10).map((suggestion, i) => (
                          <button
                            key={i}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b last:border-b-0"
                            onClick={() => addSpecialty(suggestion)}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="zillow">Zillow Profile URL</Label>
                  <p className="text-xs text-slate-500 mb-1">You can edit this field directly.</p>
                  <Input
                    id="zillow"
                    type="url"
                    value={formData.zillow_profile_url}
                    onChange={(e) => setFormData({ ...formData, zillow_profile_url: e.target.value })}
                    placeholder="https://www.zillow.com/profile/..."
                  />
                </div>

                <div>
                  <Label htmlFor="video">YouTube Video URL</Label>
                  <p className="text-xs text-slate-500 mb-1">You can edit this field directly.</p>
                  <Input
                    id="video"
                    type="url"
                    value={formData.sidebar_video_url}
                    onChange={(e) => setFormData({ ...formData, sidebar_video_url: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </div>

                <div>
                  <Label htmlFor="business_name">Business Name</Label>
                  <p className="text-xs text-slate-500 mb-1">You can edit this field directly.</p>
                  <Input
                    id="business_name"
                    value={formData.business_name}
                    onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                    placeholder="Business name (if different from company)"
                  />
                </div>

                <p className="text-sm text-slate-400">Each verified profile link strengthens your AIFS. Paste the direct URL to your profile on each platform.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="social_li">LinkedIn</Label>
                    <Input
                      id="social_li"
                      type="url"
                      value={formData.social_linkedin}
                      onChange={(e) => setFormData({ ...formData, social_linkedin: e.target.value })}
                      placeholder="https://linkedin.com/in/yourname"
                    />
                  </div>
                  <div>
                    <Label htmlFor="social_fb">Facebook</Label>
                    <Input
                      id="social_fb"
                      type="url"
                      value={formData.social_facebook}
                      onChange={(e) => setFormData({ ...formData, social_facebook: e.target.value })}
                      placeholder="https://facebook.com/yourpage"
                    />
                  </div>
                  <div>
                    <Label htmlFor="social_ig">Instagram</Label>
                    <Input
                      id="social_ig"
                      type="url"
                      value={formData.social_instagram}
                      onChange={(e) => setFormData({ ...formData, social_instagram: e.target.value })}
                      placeholder="https://instagram.com/yourhandle"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="social_tw">Twitter/X</Label>
                    <Input
                      id="social_tw"
                      type="url"
                      value={formData.social_twitter}
                      onChange={(e) => setFormData({ ...formData, social_twitter: e.target.value })}
                      placeholder="https://x.com/yourhandle"
                    />
                  </div>
                  <div>
                    <Label htmlFor="social_tt">TikTok</Label>
                    <Input
                      id="social_tt"
                      type="url"
                      value={formData.social_tiktok}
                      onChange={(e) => setFormData({ ...formData, social_tiktok: e.target.value })}
                      placeholder="https://tiktok.com/@yourhandle"
                    />
                  </div>
                </div>


              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/funnel/${token}/review-credentials`)}
                  className="gap-2 border-white/20 text-slate-300 hover:text-white hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
