import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle2, AlertCircle, Star, MapPin, Phone, Globe, Award, ChevronDown, ChevronUp, Shield, ShieldCheck, ExternalLink, Loader2, Info, Mail, Home, Building2, Users, TrendingUp, DollarSign, Key, Edit, Save, X, User, Newspaper, MessageSquare } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { Professional } from "@/types/professional";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";
import { ContactProfessionalModal } from "./ContactProfessionalModal";
import { ExternalReviewsPreview } from "./ExternalReviewsPreview";
import { CitationBlock } from "./CitationBlock";
import { getLicenseLookupByStateAbbr } from "@/data/stateLicenseLookups";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { extractYearsFromBio } from "@/utils/bioParser";


interface ProfessionalCardProps {
  professional: Professional;
  accentColor?: "primary" | "sunset-orange" | "terracotta" | "turquoise" | "cactus-green";
  schemaType?: string;
  market?: string;
  stateAbbr?: string;
  agentType?: string;
  citySlug?: string;
  categorySlug?: string;
  onContactClick?: () => void;
  quizCompleted?: boolean;
  showContactModal?: boolean;
}

export const ProfessionalCard = ({ 
  professional, 
  accentColor = "primary",
  schemaType = "Person",
  market = "",
  stateAbbr: propStateAbbr,
  agentType = "",
  citySlug,
  categorySlug,
  onContactClick,
  quizCompleted = true,
  showContactModal: externalShowContactModal
}: ProfessionalCardProps) => {
  const { trackEvent } = useGA4Tracking();
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [license, setLicense] = useState<string | null>(professional.license_number || null);
  const [verifying, setVerifying] = useState(false);
  const [extractedYears, setExtractedYears] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Collapsible bar states
  const [bioOpen, setBioOpen] = useState(false);
  const [showFullSynthesizedBio, setShowFullSynthesizedBio] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);
  
  // Press enrichment states
  const [enrichingPress, setEnrichingPress] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Helper to strip HTML tags
  const stripHtml = (html: string): string => {
    if (!html) return '';
    const withoutTags = html.replace(/<[^>]*>/g, '');
    const textarea = document.createElement('textarea');
    textarea.innerHTML = withoutTags;
    return textarea.value;
  };
  
  // Get actual total_sales using same fallback logic as display
  const getActualTotalSales = () => {
    const agentStats = (professional as any).agent_sales_stats;
    const toNum = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    
    return toNum((professional as any).total_sales) ||
           toNum(agentStats?.countAllTime) ||
           toNum(agentStats?.countLastYear) ||
           0;
  };
  
  // Get clean bio text
  const getCleanBio = () => {
    const bioHtml = (professional as any).get_to_know_me;
    const description = (professional as any).description;
    const source = bioHtml || description || '';
    return stripHtml(source);
  };
  
  const [editedData, setEditedData] = useState({
    license_number: professional.license_number || "",
    total_sales: getActualTotalSales(),
    years_experience: professional.years_experience || 0,
    description: getCleanBio(),
    website: professional.website || "",
    phone: professional.phone || "",
    email: professional.email || "",
    zillow_profile_url: (professional as any).zillow_profile_url || "",
    sidebar_video_url: (professional as any).sidebar_video_url || "",
    specialty: (professional as any).specialty || [],
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>([]);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const isLicenseVerified = !!(professional as any).license_verified_at;
  const borderColorClass = `border-l-${accentColor}`;
  const shadowColorClass = `hover:shadow-${accentColor}/10`;
  
// Zillow stats fetching disabled to improve performance; showing stored values only

  // Background: fetch accurate Zillow stats only if DB values are missing
  const [liveStats, setLiveStats] = useState<any | null>(null);
  const profileUrl = (professional as any).zillow_profile_url || ((professional as any).zuid ? `https://www.zillow.com/profile/${(professional as any).zuid}` : null);
  const needsStats = true;

  // Zillow auto-fetching removed - all scraper functionality has been disconnected

  const listingUrl = typeof window !== 'undefined' ? window.location.href : '';
  
  // Use prop stateAbbr if provided, otherwise extract from market
  const stateAbbr = propStateAbbr || market?.split(',').pop()?.trim() || '';
  const licenseLookupUrl = stateAbbr ? getLicenseLookupByStateAbbr(stateAbbr) : null;
  
  // Use external control if provided, otherwise use local state
  const isContactModalOpen = externalShowContactModal !== undefined ? externalShowContactModal : showContactModal;

  // Check if current user owns this profile and check admin role
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      console.log('Current user:', user?.email, 'Professional email:', professional.email);
      
      // Check if user is admin
      if (user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        
        setIsAdmin(!!roleData);
      }
    };
    checkAuth();
  }, []);

  // Allow editing if user's email matches professional's email OR if claimed_by matches user ID
  const isOwnProfile = currentUser && (
    currentUser.email === professional.email || 
    (professional as any).claimed_by === currentUser.id
  );

  // Update editedData with parsedProfInfo values when entering edit mode
  useEffect(() => {
    if (isEditing && parsedProfInfo) {
      setEditedData(prev => ({
        ...prev,
        website: parsedProfInfo.websiteUrl || prev.website,
        phone: parsedProfInfo.phone || prev.phone,
        email: parsedProfInfo.email || prev.email,
      }));
    }
  }, [isEditing]);

  // Fetch available specialties for editing
  useEffect(() => {
    const fetchSpecialties = async () => {
      const { data, error } = await supabase
        .from('specialties')
        .select('name')
        .eq('active', true)
        .order('name');
      
      if (error) {
        console.error('Error fetching specialties:', error);
      } else {
        setAvailableSpecialties(data?.map(s => s.name) || []);
      }
    };
    
    if (isOwnProfile) {
      fetchSpecialties();
    }
  }, [isOwnProfile]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile) return null;

    const fileExt = photoFile.name.split('.').pop();
    const fileName = `${professional.id}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('professional-photos')
      .upload(filePath, photoFile, { upsert: true });

    if (uploadError) {
      console.error('Error uploading photo:', uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('professional-photos')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const verifyLicenseNumber = async (licenseNumber: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-arizona-license', {
        body: { licenseNumber, professionalId: professional.id }
      });

      if (error) throw error;
      return data?.verified || false;
    } catch (error) {
      console.error('Error verifying license:', error);
      return false;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let photoUrl = (professional as any).image_url;

      if (photoFile) {
        photoUrl = await uploadPhoto();
      }

      let licenseVerified = isLicenseVerified;
      if (editedData.license_number !== professional.license_number) {
        licenseVerified = await verifyLicenseNumber(editedData.license_number);
        if (licenseVerified) {
          toast.success("License verified successfully!");
        } else {
          toast.info("License not found in Arizona records, using your entry");
        }
      }

      const updateData: any = {
        license_number: editedData.license_number,
        total_sales: parseInt(editedData.total_sales.toString()) || 0,
        years_experience: parseInt(editedData.years_experience.toString()) || 0,
        description: editedData.description,
        website: editedData.website,
        phone: editedData.phone,
        email: editedData.email,
        zillow_profile_url: editedData.zillow_profile_url,
        sidebar_video_url: editedData.sidebar_video_url,
        specialty: editedData.specialty,
      };

      if (photoUrl) {
        updateData.image_url = photoUrl;
      }

      if (licenseVerified) {
        updateData.license_verified_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('professionals')
        .update(updateData)
        .eq('id', professional.id);

      if (error) throw error;

      toast.success("Profile updated successfully!");
      setIsEditing(false);
      window.location.reload();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const toggleSpecialty = (specialty: string) => {
    setEditedData(prev => ({
      ...prev,
      specialty: prev.specialty.includes(specialty) 
        ? prev.specialty.filter((s: string) => s !== specialty)
        : [...prev.specialty, specialty]
    }));
  };

  const addCustomSpecialty = async () => {
    if (!newSpecialty.trim()) return;

    const specialty = newSpecialty.trim();
    
    if (availableSpecialties.includes(specialty)) {
      toggleSpecialty(specialty);
      setNewSpecialty('');
      return;
    }

    try {
      const { error } = await supabase
        .from('specialties')
        .insert({ name: specialty, active: true });

      if (error && !error.message.includes('duplicate')) throw error;

      setAvailableSpecialties(prev => [...prev, specialty].sort());
      toggleSpecialty(specialty);
      setNewSpecialty('');
      toast.success('Specialty added!');
    } catch (error) {
      console.error('Error adding specialty:', error);
      toast.error('Failed to add specialty');
    }
  };

  // Parse Adam-style JSON bio once at the top
  const parsedProfInfo = (() => {
    try {
      // ALWAYS extract website and phone from professional_information if available
      const profInfoArray = (professional as any).professional_information;
      let websiteFromProfInfo: string | null = null;
      let phoneFromProfInfo: string | null = null;
      let emailFromProfInfo: string | null = null;
      
      if (Array.isArray(profInfoArray) && profInfoArray.length > 0) {
        type InfoEntry = { 
          term?: string; 
          description?: string; 
          lines?: string[]; 
          links?: { text?: string; url?: string }[];
        };
        const entries = profInfoArray as InfoEntry[];
        
        // Extract primary website only (no social links)
        const websitesEntry = entries.find(e => e.term === 'Websites');
        if (websitesEntry?.links && Array.isArray(websitesEntry.links)) {
          // Find first non-social link
          const primaryWebsiteLink = websitesEntry.links.find(link => {
            const url = link.url || '';
            const text = (link.text || '').toLowerCase();
            // Skip social media sites
            return url && 
              !url.includes('facebook.com') &&
              !url.includes('linkedin.com') &&
              !url.includes('twitter.com') &&
              !url.includes('x.com') &&
              !url.includes('instagram.com') &&
              !url.includes('tiktok.com') &&
              !url.includes('youtube.com') &&
              !url.includes('pinterest.com') &&
              !text.includes('facebook') &&
              !text.includes('linkedin') &&
              !text.includes('instagram') &&
              !text.includes('tiktok') &&
              !text.includes('youtube') &&
              !text.includes('pinterest');
          });
          
          websiteFromProfInfo = primaryWebsiteLink?.url || null;
        }
        
        if (!websiteFromProfInfo && websitesEntry?.links?.[0]?.url) {
          websiteFromProfInfo = websitesEntry.links[0].url;
        }
        
        // Extract email from any entry whose term mentions email, or from links
        const emailEntry = entries.find(e => (e.term || '').toLowerCase().includes('email'));
        if (emailEntry) {
          const candidates: string[] = [];
          if (Array.isArray(emailEntry.lines)) candidates.push(...emailEntry.lines);
          if (emailEntry.description) candidates.push(emailEntry.description);
          if (Array.isArray(emailEntry.links)) {
            emailEntry.links.forEach(link => {
              if (link.text) candidates.push(link.text);
              if (link.url && link.url.startsWith('mailto:')) {
                candidates.push(link.url.replace('mailto:', ''));
              }
            });
          }
          
          // Look for valid email format
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
          for (const raw of candidates) {
            if (!raw) continue;
            const match = raw.match(emailRegex);
            if (match) {
              emailFromProfInfo = match[0].trim();
              break;
            }
          }
          
          // Fallback: if no regex match, just use first non-empty line/description
          if (!emailFromProfInfo) {
            const rawLine = candidates.find(l => l && l.trim().length > 0 && l.includes('@'));
            if (rawLine) {
              const parts = rawLine.split(':');
              emailFromProfInfo = (parts.length > 1 ? parts.slice(1).join(':') : rawLine).trim();
            }
          }
        }
        
        // Extract phone from any entry whose term mentions phone (e.g. "Phone", "Phone numbers")
        const phoneEntry = entries.find(e => (e.term || '').toLowerCase().includes('phone'));
        if (phoneEntry) {
          const candidates: string[] = [];
          if (Array.isArray(phoneEntry.lines)) candidates.push(...phoneEntry.lines);
          if (phoneEntry.description) candidates.push(phoneEntry.description);
          
          // Look for something that looks like a US phone number
          const phoneRegex = /(\+?1[\s.-]?)?(\(?\d{3}\)?)[\s.-]?\d{3}[\s.-]?\d{4}/;
          for (const raw of candidates) {
            if (!raw) continue;
            const match = raw.match(phoneRegex);
            if (match) {
              phoneFromProfInfo = match[0].trim();
              break;
            }
          }
          
          // Fallback: if no regex match, just use first non-empty line/description
          if (!phoneFromProfInfo) {
            const rawLine = candidates.find(l => l && l.trim().length > 0);
            if (rawLine) {
              const parts = rawLine.split(':');
              phoneFromProfInfo = (parts.length > 1 ? parts.slice(1).join(':') : rawLine).trim();
            }
          }
        }
      }

      console.debug('parsedProfInfo contact sources', {
        name: professional.name,
        fromProfessionalInformation: { phone: phoneFromProfInfo, email: emailFromProfInfo },
        topLevel: { phone: (professional as any).phone, email: professional.email },
      });
      

      // Primary source: description/get_to_know_me JSON blob from memo23
      const descRaw = (professional as any).description as string | null;
      const getToKnowRaw = (professional as any).get_to_know_me as string | null;
      const profInfoRaw = descRaw || getToKnowRaw || profInfoArray;

      if (!profInfoRaw) {
        return websiteFromProfInfo || phoneFromProfInfo || emailFromProfInfo ? { 
          yearsInIndustry: null,
          videoUrl: null,
          specialties: [] as string[],
          websiteUrl: websiteFromProfInfo,
          phone: phoneFromProfInfo,
          email: emailFromProfInfo,
          description: null
        } : null;
      }

      // If it's already plain text (our rewritten bio), just surface it
      if (typeof profInfoRaw === 'string') {
        const trimmed = profInfoRaw.trim();

        // Heuristic: if it doesn't look like JSON, treat as plain bio text
        const looksLikeJson = trimmed.startsWith('{') && trimmed.endsWith('}');
        if (!looksLikeJson) {
          return {
            yearsInIndustry: null,
            videoUrl: null,
            specialties: [] as string[],
            websiteUrl: websiteFromProfInfo,
            phone: phoneFromProfInfo,
            email: emailFromProfInfo,
            description: trimmed
          };
        }

        // Try to parse memo23-style JSON (newer format)
        const parsed = JSON.parse(trimmed);
        if (!parsed || typeof parsed !== 'object' || !('description' in parsed)) {
          return {
            yearsInIndustry: null,
            videoUrl: null,
            specialties: [] as string[],
            websiteUrl: websiteFromProfInfo,
            phone: phoneFromProfInfo,
            email: emailFromProfInfo,
            description: trimmed
          };
        }

        // Clean description HTML from memo23 JSON
        let cleanDescription = '';
        if ((parsed as any).description) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = (parsed as any).description;
          cleanDescription = (tempDiv.textContent || tempDiv.innerText || '').trim();
        }

        return {
          yearsInIndustry: (parsed as any).yearsInIndustry ?? null,
          videoUrl: (parsed as any).videoUrl ?? null,
          specialties: Array.isArray((parsed as any).specialties) ? (parsed as any).specialties : [],
          websiteUrl: websiteFromProfInfo || (parsed as any).websiteUrl || null,
          phone: phoneFromProfInfo,
          email: emailFromProfInfo,
          description: cleanDescription || trimmed
        };
      }

      // Handle legacy memo23 JSONB array from professional_information for description
      if (Array.isArray(profInfoArray) && profInfoArray.length > 0) {
        type InfoEntry = { term?: string; description?: string; lines?: string[]; links?: { text?: string; url?: string }[] };
        const entries = profInfoArray as InfoEntry[];

        const findByTerm = (term: string) => entries.find(e => e.term === term);

        const addressEntry = findByTerm('Broker address');
        const memberSinceEntry = findByTerm('Member since');

        const descriptionParts: string[] = [];
        if (addressEntry?.lines?.length) {
          descriptionParts.push(addressEntry.lines[0]);
        }
        if (memberSinceEntry?.description) {
          descriptionParts.push(`Member since ${memberSinceEntry.description}`);
        }

        const description = descriptionParts.join('. ');

        return {
          yearsInIndustry: null,
          videoUrl: null,
          specialties: [] as string[],
          websiteUrl: websiteFromProfInfo,
          phone: phoneFromProfInfo,
          email: emailFromProfInfo,
          description: description || null
        };
      }

      // If we somehow get a non-string (JSONB) without recognisable structure, fall back to simple description field
      const fallback = (professional as any).description as string | null;
      if (!fallback) {
        return websiteFromProfInfo || phoneFromProfInfo || emailFromProfInfo ? {
          yearsInIndustry: null,
          videoUrl: null,
          specialties: [] as string[],
          websiteUrl: websiteFromProfInfo,
          phone: phoneFromProfInfo,
          email: emailFromProfInfo,
          description: null
        } : null;
      }
      return {
        yearsInIndustry: null,
        videoUrl: null,
        specialties: [] as string[],
        websiteUrl: websiteFromProfInfo,
        phone: phoneFromProfInfo,
        email: emailFromProfInfo,
        description: fallback.trim()
      };
    } catch (e) {
      console.error('Error parsing memo23-style description JSON:', e);
      const fallback = (professional as any).description as string | null;
      if (!fallback) return null;
      return {
        yearsInIndustry: null,
        videoUrl: null,
        specialties: [] as string[],
        websiteUrl: null,
        phone: null,
        email: null,
        description: fallback.trim()
      };
    }
  })();

  // CRITICAL: Extract years from bio on mount and update database if needed
  useEffect(() => {
    const bioText = parsedProfInfo?.description || (professional as any).description || (professional as any).get_to_know_me;
    console.log(`[${professional.name}] Checking bio for years of experience...`);
    console.log(`[${professional.name}] Bio text:`, bioText?.substring(0, 200));
    
    if (bioText) {
      const bioYears = extractYearsFromBio(bioText);
      console.log(`[${professional.name}] Extracted years from bio:`, bioYears);
      console.log(`[${professional.name}] Current DB years_experience:`, professional.years_experience);
      
      if (bioYears !== null) {
        setExtractedYears(bioYears);
        
        // Only backfill database when no verified value exists yet
        if ((professional.years_experience == null || professional.years_experience <= 0) && professional.id && bioYears !== professional.years_experience) {
          console.log(`[${professional.name}] Backfilling database years_experience from bio: ${bioYears} years`);
          supabase
            .from('professionals')
            .update({ years_experience: bioYears })
            .eq('id', professional.id)
            .then(({ error }) => {
              if (error) {
                console.error(`[${professional.name}] Error updating years_experience:`, error);
              } else {
                console.log(`[${professional.name}] Successfully backfilled years_experience to ${bioYears}`);
              }
            });
        }
      }
    }
  }, [professional.id, professional.name, professional.years_experience, parsedProfInfo?.description]);

  // Extract video info for responsive layout (after parsedProfInfo is available)
  const videoUrl = parsedProfInfo?.videoUrl || (professional as any).sidebar_video_url;
  const hasVideo = !!(videoUrl);
  const videoId = videoUrl && (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'))
    ? videoUrl.split('v=')[1]?.split('&')[0] || videoUrl.split('/').pop()?.split('?')[0]
    : null;

  const handleWebsiteClick = (e: React.MouseEvent) => {
    e.preventDefault();

    // Use websiteUrl from parsedProfInfo if available
    const websiteSource = parsedProfInfo?.websiteUrl || professional.website || "";

    // Check if we have a valid website
    if (!websiteSource.trim()) {
      const firstName = professional.name.split(" ")[0];
      toast.info(
        `Sorry, it doesn't look like ${firstName} has their own website. Try contacting them.`,
      );
      return;
    }

    const url = (() => {
      let v = websiteSource.trim();
      // Fix common malformed patterns
      if (/^https?:\/\/https?:\/\//i.test(v)) v = v.replace(/^https?:\/\/https?:\/\//i, "https://");
      if (/^https\/:\/\//i.test(v)) v = v.replace(/^https\/:\/\//i, "https://");
      if (/^http\/:\/\//i.test(v)) v = v.replace(/^http\/:\/\//i, "http://");
      if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
      return v;
    })();

    // If the "website" is actually a Zillow URL, treat it as missing personal site
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("zillow.com")) {
        const firstName = professional.name.split(" ")[0];
        toast.info(
          `Sorry, it doesn't look like ${firstName} has their own website. Try contacting them.`,
        );
        return;
      }
    } catch {
      // If URL parsing fails, we'll still attempt navigation after tracking
    }

    trackEvent("agent_profile_click", {
      agent_name: professional.name,
      market,
      destination_url: url,
      agent_type: agentType,
    });

    trackEvent("contact_cta_click", {
      agent_name: professional.name,
      market,
      agent_type: agentType,
    });

    // Proactively check if the external site looks valid before sending the user there
    (async () => {
      try {
        const response = await fetch(url, { method: "HEAD" });

        if (response.ok && response.status < 400) {
          window.open(url, "_blank", "noopener,noreferrer");
        } else {
          const firstName = professional.name.split(" ")[0];
          toast.info(
            `Sorry, it doesn't look like ${firstName} has their own website. Try contacting them.`,
          );
        }
      } catch {
        // If we can't determine the status (CORS/network), fall back to opening the site
        window.open(url, "_blank", "noopener,noreferrer");
      }
    })();
  };

  const handlePhoneClick = () => {
    trackEvent('contact_cta_click', {
      agent_name: professional.name,
      market,
      agent_type: agentType
    });
  };

  const handleVerifyLicense = async () => {
    try {
      setVerifying(true);
      trackEvent('license_verify_click', {
        agent_name: professional.name,
        market,
        state: stateAbbr,
      });

      const { data, error } = await supabase.functions.invoke('lookup-agent-license', {
        body: {
          agentName: professional.name,
          state: stateAbbr,
          licensePortalUrl: licenseLookupUrl || undefined,
        },
      });

      if (error) throw error;
      const found: string | null = data?.licenseNumber || data?.license_number || null;

      if (found) {
        if (professional.id) {
          const { error: updateError } = await supabase
            .from('professionals')
            .update({ license_number: found, license_verified_at: new Date().toISOString() })
            .eq('id', professional.id);
          if (updateError) {
            console.error('Failed to save license:', updateError);
          }
        }
        setLicense(found);
        toast.success(`License verified: ${found}`);
        trackEvent('badge_hover', {
          badge_type: 'Verified',
          agent_name: professional.name,
          market
        });
      } else {
        toast.error('No license found.');
      }
    } catch (e: any) {
      console.error('License verification failed', e);
      toast.error('Verification failed. Please try again later.');
    } finally {
      setVerifying(false);
    }
  };
  const handleBadgeHover = () => {
    if (professional.verified) {
      trackEvent('badge_hover', {
        badge_type: 'Verified',
        agent_name: professional.name,
        market
      });
    }
  };

  return (
    <Card 
      className={`border-2 border-l-4 ${borderColorClass} hover:shadow-lg ${shadowColorClass} transition-all`}
      itemScope 
      itemType={`https://schema.org/${schemaType}`}
    >
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {/* Photo with specialties below */}
          <div className="flex-shrink-0">
            <div className="relative">
              <img 
                src={photoPreview || professional.image || (professional as any).image_url || '/api/placeholder/400/400'} 
                alt={`${professional.name} - Top professional${(professional.specialties || (professional as any).specialty)?.length ? ` specializing in ${(professional.specialties || (professional as any).specialty).slice(0, 3).join(', ')}` : ''}`}
                className="w-24 h-24 md:w-32 md:h-32 rounded-lg object-cover border-2 border-border"
                itemProp="image"
                onError={(e) => {
                  // Fallback to placeholder if image fails to load
                  (e.target as HTMLImageElement).src = '/api/placeholder/400/400';
                }}
              />
              {isOwnProfile && isEditing && (
                <label className="absolute -top-2 -right-2 cursor-pointer bg-primary text-primary-foreground rounded-full p-1.5 hover:bg-primary/90 shadow-lg">
                  <Edit className="h-3 w-3" />
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handlePhotoChange}
                  />
                </label>
              )}
            </div>
            
            {/* Updated date under photo */}
            {(professional as any).zillow_data_fetched_at && (
              <div className="mt-2 text-xs text-muted-foreground text-center">
                Updated: {format(new Date((professional as any).zillow_data_fetched_at), 'MMM d, yyyy')}
              </div>
            )}
            
            {/* Specialties editor or display - Hidden on mobile, shown on desktop */}
            <div className="hidden md:block">
              {isOwnProfile && isEditing ? (
                <div className="mt-4 space-y-3 w-full">
                  <h4 className="text-sm font-semibold">Specialties</h4>
                  
                  {/* Available specialties */}
                  <div className="flex flex-wrap gap-2">
                    {availableSpecialties.map((specialty) => {
                      const isSelected = editedData.specialty.includes(specialty);
                      return (
                        <Badge
                          key={specialty}
                          variant={isSelected ? 'default' : 'outline'}
                          className="cursor-pointer hover:opacity-80 transition-opacity text-xs"
                          onClick={() => toggleSpecialty(specialty)}
                        >
                          {specialty}
                          {isSelected && <X className="h-3 w-3 ml-1" />}
                        </Badge>
                      );
                    })}
                  </div>

                  {/* Add custom specialty */}
                  <div className="flex gap-2">
                    <Input
                      value={newSpecialty}
                      onChange={(e) => setNewSpecialty(e.target.value)}
                      placeholder="Add custom specialty..."
                      className="text-sm"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomSpecialty();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      onClick={addCustomSpecialty}
                      disabled={!newSpecialty.trim()}
                      variant="outline"
                      size="sm"
                    >
                      Add
                    </Button>
                  </div>

                  {/* Selected specialties preview */}
                  {editedData.specialty.length > 0 && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">Selected ({editedData.specialty.length}):</p>
                      <div className="flex flex-wrap gap-2">
                        {editedData.specialty.map((specialty: string) => (
                          <Badge
                            key={specialty}
                            variant="secondary"
                            className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground text-xs"
                            onClick={() => toggleSpecialty(specialty)}
                          >
                            {specialty}
                            <X className="h-3 w-3 ml-1" />
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Display specialties */
                (() => {
                  const profileTypeMap: Record<string, string> = {
                    'consumer': 'Buyer Representation',
                    'agent': 'Full-Service Agent',
                    'renter': 'Rental Specialist',
                    'showcaseBuyer': 'Luxury Homes',
                    'peeps': 'Client Reviews',
                    'listing': 'Listing Specialist',
                    'foreclosure': 'Foreclosure Expert',
                    'newConstruction': 'New Construction',
                    'relocation': 'Relocation Services',
                    'investment': 'Investment Properties'
                  };
                  
                  const profileTypes = ((professional as any).profile_types || []) as string[];
                  const mappedProfileTypes = profileTypes
                    .map(pt => profileTypeMap[pt])
                    .filter(Boolean);
                  
                  const dbSpecialties = professional.specialties || (professional as any).specialty || [];
                  const parsedSpecialties = parsedProfInfo?.specialties || [];
                  
                  const profInfoArray = (professional as any).professional_information;
                  const extractedSpecialties: string[] = [];
                  const extractedLanguages: string[] = [];
                  
                  if (Array.isArray(profInfoArray)) {
                    // Extract specialties
                    const specialtiesEntry = profInfoArray.find((e: any) => 
                      e.term === 'Specialties' || e.term === 'Areas of Focus' || e.term === 'Service areas'
                    );
                    if (specialtiesEntry) {
                      const rawData = specialtiesEntry.detail || specialtiesEntry.lines || specialtiesEntry.description;
                      if (Array.isArray(rawData)) {
                        rawData.forEach((item: any) => {
                          if (typeof item === 'string' && item.trim()) {
                            extractedSpecialties.push(item.trim());
                          } else if (item?.text) {
                            extractedSpecialties.push(item.text);
                          }
                        });
                      } else if (typeof rawData === 'string' && rawData.trim()) {
                        extractedSpecialties.push(rawData.trim());
                      }
                    }
                    
                    // Extract languages
                    const languagesEntry = profInfoArray.find((e: any) => 
                      e.term === 'Languages' || e.term === 'Languages spoken'
                    );
                    if (languagesEntry) {
                      const rawData = languagesEntry.description || languagesEntry.lines;
                      if (typeof rawData === 'string' && rawData.trim()) {
                        // Split by comma and clean up, filtering out English if more than 1 language
                        const langs = rawData.split(',').map(l => l.trim()).filter(Boolean);
                        const nonEnglishLangs = langs.filter(l => l.toLowerCase() !== 'english');
                        // If they list multiple languages including English, only show non-English
                        // If English is the only language listed, don't show it
                        if (nonEnglishLangs.length > 0) {
                          nonEnglishLangs.forEach(lang => extractedLanguages.push(lang));
                        }
                      } else if (Array.isArray(rawData)) {
                        const langs = rawData.map(l => typeof l === 'string' ? l.trim() : '').filter(Boolean);
                        const nonEnglishLangs = langs.filter(l => l.toLowerCase() !== 'english');
                        if (nonEnglishLangs.length > 0) {
                          nonEnglishLangs.forEach(lang => extractedLanguages.push(lang));
                        }
                      }
                    }
                  }
                  
                  const allSpecialties = [...new Set([...mappedProfileTypes, ...dbSpecialties, ...parsedSpecialties, ...extractedSpecialties, ...extractedLanguages])];
                  
                  if (allSpecialties.length === 0) return null;
                  
                  return (
                    <div className="mt-3 space-y-1.5 flex flex-col items-center">
                      {allSpecialties.slice(0, 5).map((specialty: string, idx: number) => {
                        const getSpecialtyIcon = (spec: string) => {
                          const lower = spec.toLowerCase();
                          // Check if it's a language (from extractedLanguages)
                          const commonLanguages = ['spanish', 'french', 'german', 'italian', 'portuguese', 'chinese', 'japanese', 'korean', 'arabic', 'russian', 'hindi', 'tagalog', 'vietnamese'];
                          if (commonLanguages.some(lang => lower.includes(lang))) return Globe;
                          if (lower.includes('residential') || lower.includes('single family')) return Home;
                          if (lower.includes('commercial') || lower.includes('business')) return Building2;
                          if (lower.includes('luxury') || lower.includes('high-end')) return TrendingUp;
                          if (lower.includes('investment') || lower.includes('investor')) return DollarSign;
                          if (lower.includes('first') || lower.includes('buyer')) return Key;
                          if (lower.includes('relocation')) return Users;
                          return Award;
                        };
                        const Icon = getSpecialtyIcon(specialty);
                        return (
                          <Badge 
                            key={idx} 
                            variant="secondary" 
                            className="text-xs w-full justify-start gap-1.5"
                            itemProp="knowsAbout"
                          >
                            <Icon className="h-3 w-3" />
                            {specialty}
                          </Badge>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          </div>

          {/* Content - flexible with min-w-0 to prevent overflow */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Header section */}
            <div className="space-y-2">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                     {/* Semantic heading for SEO */}
                     <div className="flex items-center gap-2 flex-wrap">
                       <h3 className="text-2xl font-bold" itemProp="name">
                         {professional.name}
                         {professional.title && <span className="text-muted-foreground">, {professional.title}</span>}
                       </h3>
                       {professional.verified && (
                         <Badge 
                           variant="secondary" 
                           className="gap-1 agent-badge"
                           onMouseEnter={handleBadgeHover}
                         >
                           <Award className="h-3 w-3" />
                           Verified
                         </Badge>
                       )}
                       {isOwnProfile && !isEditing && (
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => setIsEditing(true)}
                           className="ml-2"
                         >
                           <Edit className="h-4 w-4 mr-1" />
                           Edit Profile
                         </Button>
                       )}
                     </div>
                     <p className="text-lg text-muted-foreground" itemProp="affiliation">
                       {professional.company}
                     </p>
                     
                      {/* Contact Info - Vertical under name */}
                      <h4 className="sr-only">Contact Information</h4>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <a
                            href={(() => {
                              const websiteSource = parsedProfInfo?.websiteUrl || professional.website || '';
                              let v = websiteSource.trim();
                              
                              if (!v) return '#';
                              
                              if (/^https?:\/\/https?:\/\//i.test(v)) v = v.replace(/^https?:\/\/https?:\/\//i, 'https://');
                              if (/^https\/\//i.test(v)) v = v.replace(/^https\/\//i, 'https://');
                              if (/^http\/\//i.test(v)) v = v.replace(/^http\/\//i, 'http://');
                              if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
                              return v;
                            })()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline agent-profile-link"
                            itemProp="url"
                            onClick={handleWebsiteClick}
                          >
                            Official Website
                          </a>
                        </div>
                       
                       <div className="flex items-center gap-2">
                         <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                         {(() => {
                           const emailDisplay = parsedProfInfo?.email || professional.email;
                           if (emailDisplay) {
                             return (
                                <a 
                                  href={`mailto:${emailDisplay}`} 
                                  className="text-primary hover:underline" 
                                  itemProp="email"
                                >
                                  Direct Email
                                </a>
                             );
                           }
                           return <span className="text-muted-foreground">NA</span>;
                         })()}
                       </div>
                       
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          {(() => {
                            const phoneDisplay = parsedProfInfo?.phone || professional.phone;
                            if (phoneDisplay) {
                              return (
                                <a 
                                  href={`tel:${phoneDisplay}`} 
                                  className="text-primary hover:underline contact-agent-button" 
                                  itemProp="telephone"
                                  onClick={handlePhoneClick}
                                >
                                  {phoneDisplay}
                                </a>
                              );
                            }
                            return <span className="text-muted-foreground">NA</span>;
                          })()}
                        </div>
                        
                        {/* Social Links */}
                        {(() => {
                          // Merge social URLs from raw_scraper_data AND direct database columns
                          const scraperSocials = (professional as any).raw_scraper_data?.social_urls || {};
                          const dbSocials = {
                            facebook: (professional as any).social_facebook,
                            instagram: (professional as any).social_instagram,
                            linkedin: (professional as any).social_linkedin,
                            x: (professional as any).social_twitter,
                            tiktok: (professional as any).social_tiktok,
                          };
                          // DB columns take precedence over scraped data
                          const socialUrls = {
                            facebook: dbSocials.facebook || scraperSocials.facebook,
                            instagram: dbSocials.instagram || scraperSocials.instagram,
                            linkedin: dbSocials.linkedin || scraperSocials.linkedin,
                            x: dbSocials.x || scraperSocials.x || scraperSocials.twitter,
                            tiktok: dbSocials.tiktok || scraperSocials.tiktok,
                            youtube: scraperSocials.youtube,
                            pinterest: scraperSocials.pinterest,
                          };
                          
                          const hasAnySocial = Object.values(socialUrls).some(v => !!v);
                          if (!hasAnySocial) return null;
                          
                          const handleSocialClick = (platform: string, url: string) => (e: React.MouseEvent) => {
                            e.preventDefault();
                            trackEvent('social_link_click', {
                              agent_name: professional.name,
                              platform: platform,
                              market: market
                            });
                            window.open(url, '_blank', 'noopener,noreferrer');
                          };
                          
                          return (
                            <div className="flex flex-wrap gap-2 pt-2">
                              {socialUrls.facebook && (
                                <a
                                  href={socialUrls.facebook}
                                  onClick={handleSocialClick('facebook', socialUrls.facebook)}
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                  aria-label="Facebook profile"
                                >
                                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                  </svg>
                                </a>
                              )}
                              {socialUrls.instagram && (
                                <a
                                  href={socialUrls.instagram}
                                  onClick={handleSocialClick('instagram', socialUrls.instagram)}
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                  aria-label="Instagram profile"
                                >
                                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                  </svg>
                                </a>
                              )}
                              {socialUrls.linkedin && (
                                <a
                                  href={socialUrls.linkedin}
                                  onClick={handleSocialClick('linkedin', socialUrls.linkedin)}
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                  aria-label="LinkedIn profile"
                                >
                                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                  </svg>
                                </a>
                              )}
                              {socialUrls.x && (
                                <a
                                  href={socialUrls.x}
                                  onClick={handleSocialClick('x', socialUrls.x)}
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                  aria-label="X (Twitter) profile"
                                >
                                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                  </svg>
                                </a>
                              )}
                              {socialUrls.youtube && (
                                <a
                                  href={socialUrls.youtube}
                                  onClick={handleSocialClick('youtube', socialUrls.youtube)}
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                  aria-label="YouTube channel"
                                >
                                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                  </svg>
                                </a>
                              )}
                              {socialUrls.tiktok && (
                                <a
                                  href={socialUrls.tiktok}
                                  onClick={handleSocialClick('tiktok', socialUrls.tiktok)}
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                  aria-label="TikTok profile"
                                >
                                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                                  </svg>
                                </a>
                              )}
                              {socialUrls.pinterest && (
                                <a
                                  href={socialUrls.pinterest}
                                  onClick={handleSocialClick('pinterest', socialUrls.pinterest)}
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                  aria-label="Pinterest profile"
                                >
                                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 0c-6.627 0-12 5.372-12 12 0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146 1.124.347 2.317.535 3.554.535 6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/>
                                  </svg>
                                </a>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                   </div>
                </div>

              {/* License Number Section */}
              <div className="space-y-1.5 py-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>License #:</span>
                </div>
                
                  {isOwnProfile && isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editedData.license_number}
                        onChange={(e) => setEditedData({ ...editedData, license_number: e.target.value })}
                        placeholder="Enter license number"
                        className="h-8 max-w-xs"
                      />
                    </div>
                  ) : verifying ? (
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-32 bg-muted animate-pulse rounded" />
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                  ) : license ? (
                    <div className="flex flex-col gap-1.5">
                      <Badge variant="outline" className="gap-1.5 px-2.5 py-0.5 text-xs font-medium tracking-wide w-fit">
                        {license}
                      </Badge>
                      {isLicenseVerified && (
                        <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Verified via Arizona Department of Real Estate
                        </span>
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs w-fit"
                      onClick={handleVerifyLicense}
                      disabled={!licenseLookupUrl}
                    >
                      <Shield className="h-3.5 w-3.5" />
                      Verify
                    </Button>
                  )}
              </div>

              {/* Rating & Statistics Combined */}
              {(() => {
                const statFromObj = (obj: any, path: string) => {
                  try { const v = path.split('.').reduce((o: any, k: string) => (o ? o[k] : undefined), obj); return v; } catch { return undefined; }
                };

                const toNum = (v: any) => {
                  const n = Number(v);
                  return Number.isFinite(n) ? n : null;
                };

                const agentStats = (professional as any).agent_sales_stats;

                const totalSales =
                  toNum(professional.total_sales) ??
                  toNum(statFromObj(agentStats, 'countAllTime')) ??
                  toNum(statFromObj(agentStats, 'countLastYear')) ??
                  toNum(statFromObj(professional, 'stats.totalSales')) ??
                  toNum(statFromObj(professional, 'stats.sold')) ??
                  toNum((liveStats as any)?.totalSales) ??
                  toNum((liveStats as any)?.total_sales) ??
                  toNum((liveStats as any)?.sold);

                // Years of experience: use database/structured values only, never fall back to bio text
                const dbYears = (professional as any).years_experience ?? statFromObj(professional, 'stats.yearsExperience');
                const yearsExperience = typeof dbYears === 'number' && dbYears > 0 ? dbYears : null;
                

                // Support both Professional interface (rating/reviews) and raw DB fields (review_stars_rating/num_total_reviews)
                const displayRating = professional.rating || (professional as any).review_stars_rating || 0;
                const displayReviews = professional.reviews || (professional as any).num_total_reviews || 0;

                return (
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-2">
                    {/* Rating */}
                    {displayRating > 0 ? (
                      <div className="flex items-center gap-2" itemProp="aggregateRating" itemScope itemType="https://schema.org/AggregateRating">
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-5 w-5 ${
                                i < Math.floor(displayRating)
                                  ? "fill-primary text-primary"
                                  : "text-muted"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="font-semibold" itemProp="ratingValue">{displayRating}</span>
                        <span className="text-muted-foreground">(<span itemProp="reviewCount">{displayReviews.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span> reviews)</span>
                        <meta itemProp="bestRating" content="5" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Info className="h-4 w-4" />
                        <span className="text-sm">Rating not yet available</span>
                      </div>
                    )}

                    {/* Total Sales */}
                    {isOwnProfile && isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={editedData.total_sales}
                          onChange={(e) => setEditedData({ ...editedData, total_sales: parseInt(e.target.value) || 0 })}
                          className="h-8 w-24"
                        />
                        <span className="text-xs text-muted-foreground">Total Sales</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg font-bold text-primary">
                            {(totalSales == null || Number(totalSales) <= 0) ? 'NA' : Number(totalSales).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </span>
                          {totalSales != null && Number(totalSales) > 0 && (
                            <span title="Verified from Zillow data">
                              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">Total Sales</span>
                      </div>
                    )}

                    {/* Years Experience */}
                    {isOwnProfile && isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={editedData.years_experience}
                          onChange={(e) => setEditedData({ ...editedData, years_experience: parseInt(e.target.value) || 0 })}
                          className="h-8 w-24"
                        />
                        <span className="text-xs text-muted-foreground">Years Experience</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg font-bold text-primary">
                            {(yearsExperience == null || Number(yearsExperience) <= 0) ? 'NA' : Number(yearsExperience).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </span>
                          {yearsExperience != null && Number(yearsExperience) > 0 && (
                            <span title="Verified from license database">
                              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">Years Experience</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Specialties on mobile only - shown under years experience */}
              <div className="block md:hidden mt-4">
                {isOwnProfile && isEditing ? (
                  <div className="space-y-3 w-full">
                    <h4 className="text-sm font-semibold">Specialties</h4>
                    
                    {/* Available specialties */}
                    <div className="flex flex-wrap gap-2">
                      {availableSpecialties.map((specialty) => {
                        const isSelected = editedData.specialty.includes(specialty);
                        return (
                          <Badge
                            key={specialty}
                            variant={isSelected ? 'default' : 'outline'}
                            className="cursor-pointer hover:opacity-80 transition-opacity text-xs"
                            onClick={() => toggleSpecialty(specialty)}
                          >
                            {specialty}
                            {isSelected && <X className="h-3 w-3 ml-1" />}
                          </Badge>
                        );
                      })}
                    </div>

                    {/* Add custom specialty */}
                    <div className="flex gap-2">
                      <Input
                        value={newSpecialty}
                        onChange={(e) => setNewSpecialty(e.target.value)}
                        placeholder="Add custom specialty..."
                        className="text-sm"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCustomSpecialty();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={addCustomSpecialty}
                        disabled={!newSpecialty.trim()}
                        variant="outline"
                        size="sm"
                      >
                        Add
                      </Button>
                    </div>

                    {/* Selected specialties preview */}
                    {editedData.specialty.length > 0 && (
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-2">Selected ({editedData.specialty.length}):</p>
                        <div className="flex flex-wrap gap-2">
                          {editedData.specialty.map((specialty: string) => (
                            <Badge
                              key={specialty}
                              variant="secondary"
                              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground text-xs"
                              onClick={() => toggleSpecialty(specialty)}
                            >
                              {specialty}
                              <X className="h-3 w-3 ml-1" />
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Display specialties */
                  (() => {
                    const profileTypeMap: Record<string, string> = {
                      'consumer': 'Buyer Representation',
                      'agent': 'Full-Service Agent',
                      'renter': 'Rental Specialist',
                      'showcaseBuyer': 'Luxury Homes',
                      'peeps': 'Client Reviews',
                      'listing': 'Listing Specialist',
                      'foreclosure': 'Foreclosure Expert',
                      'newConstruction': 'New Construction',
                      'relocation': 'Relocation Services',
                      'investment': 'Investment Properties'
                    };
                    
                    const profileTypes = ((professional as any).profile_types || []) as string[];
                    const mappedProfileTypes = profileTypes
                      .map(pt => profileTypeMap[pt])
                      .filter(Boolean);
                    
                    const dbSpecialties = professional.specialties || (professional as any).specialty || [];
                    const parsedSpecialties = parsedProfInfo?.specialties || [];
                    
                    const profInfoArray = (professional as any).professional_information;
                    const extractedSpecialties: string[] = [];
                    const extractedLanguages: string[] = [];
                    
                    if (Array.isArray(profInfoArray)) {
                      // Extract specialties
                      const specialtiesEntry = profInfoArray.find((e: any) => 
                        e.term === 'Specialties' || e.term === 'Areas of Focus' || e.term === 'Service areas'
                      );
                      if (specialtiesEntry) {
                        const rawData = specialtiesEntry.detail || specialtiesEntry.lines || specialtiesEntry.description;
                        if (Array.isArray(rawData)) {
                          rawData.forEach((item: any) => {
                            if (typeof item === 'string' && item.trim()) {
                              extractedSpecialties.push(item.trim());
                            } else if (item?.text) {
                              extractedSpecialties.push(item.text);
                            }
                          });
                        } else if (typeof rawData === 'string' && rawData.trim()) {
                          extractedSpecialties.push(rawData.trim());
                        }
                      }
                      
                      // Extract languages
                      const languagesEntry = profInfoArray.find((e: any) => 
                        e.term === 'Languages' || e.term === 'Languages spoken'
                      );
                      if (languagesEntry) {
                        const rawData = languagesEntry.description || languagesEntry.lines;
                        if (typeof rawData === 'string' && rawData.trim()) {
                          // Split by comma and clean up, filtering out English if more than 1 language
                          const langs = rawData.split(',').map(l => l.trim()).filter(Boolean);
                          const nonEnglishLangs = langs.filter(l => l.toLowerCase() !== 'english');
                          // If they list multiple languages including English, only show non-English
                          // If English is the only language listed, don't show it
                          if (nonEnglishLangs.length > 0) {
                            nonEnglishLangs.forEach(lang => extractedLanguages.push(lang));
                          }
                        } else if (Array.isArray(rawData)) {
                          const langs = rawData.map(l => typeof l === 'string' ? l.trim() : '').filter(Boolean);
                          const nonEnglishLangs = langs.filter(l => l.toLowerCase() !== 'english');
                          if (nonEnglishLangs.length > 0) {
                            nonEnglishLangs.forEach(lang => extractedLanguages.push(lang));
                          }
                        }
                      }
                    }
                    
                    const allSpecialties = [...new Set([...mappedProfileTypes, ...dbSpecialties, ...parsedSpecialties, ...extractedSpecialties, ...extractedLanguages])];
                    
                    if (allSpecialties.length === 0) return null;
                    
                    return (
                      <div className="space-y-1.5 flex flex-col items-center w-full">
                        {allSpecialties.slice(0, 5).map((specialty: string, idx: number) => {
                          const getSpecialtyIcon = (spec: string) => {
                            const lower = spec.toLowerCase();
                            // Check if it's a language (from extractedLanguages)
                            const commonLanguages = ['spanish', 'french', 'german', 'italian', 'portuguese', 'chinese', 'japanese', 'korean', 'arabic', 'russian', 'hindi', 'tagalog', 'vietnamese'];
                            if (commonLanguages.some(lang => lower.includes(lang))) return Globe;
                            if (lower.includes('residential') || lower.includes('single family')) return Home;
                            if (lower.includes('commercial') || lower.includes('business')) return Building2;
                            if (lower.includes('luxury') || lower.includes('high-end')) return TrendingUp;
                            if (lower.includes('investment') || lower.includes('investor')) return DollarSign;
                            if (lower.includes('first') || lower.includes('buyer')) return Key;
                            if (lower.includes('relocation')) return Users;
                            return Award;
                          };
                          const Icon = getSpecialtyIcon(specialty);
                          return (
                            <Badge 
                              key={idx} 
                              variant="secondary" 
                              className="text-xs w-full justify-start gap-1.5"
                              itemProp="knowsAbout"
                            >
                              <Icon className="h-3 w-3" />
                              {specialty}
                            </Badge>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Data Source Indicator */}
              {liveStats && (
                <div className="flex items-center justify-between gap-2 -mt-2">
                  <Badge 
                    variant="outline" 
                    className="gap-1.5 text-xs bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                    title="Statistics verified from Zillow"
                  >
                    <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                    Stats Verified
                  </Badge>
                </div>
              )}

              {/* Video URL edit field - only in editing mode */}
              {isOwnProfile && isEditing && (
                <div className="space-y-2 mb-4">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Edit className="h-4 w-4" />
                    YouTube Video URL
                  </label>
                  <Input
                    value={editedData.sidebar_video_url}
                    onChange={(e) => setEditedData({ ...editedData, sidebar_video_url: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="max-w-md"
                  />
                </div>
              )}
            </div>

              {/* Synthesized Bio Display (if available, show above buttons) */}
              {(() => {
                const synthesizedBio = (professional as any).synthesized_bio;
                if (!synthesizedBio || isEditing) return null;
                
                const CHAR_LIMIT = 400;
                const needsTruncation = synthesizedBio.length > CHAR_LIMIT;
                const displayText = showFullSynthesizedBio || !needsTruncation 
                  ? synthesizedBio 
                  : synthesizedBio.slice(0, CHAR_LIMIT) + '...';
                
                return (
                  <div className="border rounded-lg p-4 bg-primary/5 mt-3">
                    <h4 className="sr-only">Professional Summary</h4>
                    <div 
                      className="text-sm text-foreground whitespace-pre-line"
                      dangerouslySetInnerHTML={{ __html: displayText }}
                    />
                    {needsTruncation && (
                      <button
                        onClick={() => setShowFullSynthesizedBio(!showFullSynthesizedBio)}
                        className="text-primary hover:underline text-sm font-medium mt-2"
                      >
                        {showFullSynthesizedBio ? 'Show less' : 'Show more'}
                      </button>
                    )}
                    {(professional as any).profile_last_synthesized_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Profile synthesized: {format(new Date((professional as any).profile_last_synthesized_at), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* 3 Collapsible Bars - buttons in horizontal row */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3">
                {/* From [firstname] Button */}
                {(() => {
                  const bioHtml = (professional as any).get_to_know_me;
                  const description = (professional as any).description;
                  const fallbackText = description;
                  
                  if (!bioHtml && !fallbackText && !isEditing) return null;
                  
                  // Parse name to handle couples like "Don and Jenny Matheson" or "Mark & Dina Beauvais"
                  const parseDisplayName = (fullName: string): string => {
                    const andMatch = fullName.match(/^(\w+)\s+(?:and|&)\s+(\w+)\s+/i);
                    if (andMatch) {
                      return `${andMatch[1]} and ${andMatch[2]}`;
                    }
                    return fullName.split(' ')[0];
                  };
                  
                  const displayName = parseDisplayName(professional.name);
                  
                  return (
                    <button
                      onClick={() => setBioOpen(!bioOpen)}
                      className="border rounded-lg p-2.5 sm:p-3.5 bg-accent/30 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <span className="font-semibold text-xs sm:text-sm whitespace-nowrap">From {displayName}</span>
                        <ChevronDown className={cn("h-4 w-4 transition-transform flex-shrink-0", bioOpen && "rotate-180")} />
                      </div>
                    </button>
                  );
                })()}
                
                {/* Reviews Button - Always show */}
                <button
                  onClick={() => setReviewsOpen(!reviewsOpen)}
                  className="border rounded-lg p-2.5 sm:p-3.5 bg-accent/30 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
                      <span className="font-semibold text-xs sm:text-sm whitespace-nowrap">Reviews</span>
                      <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] sm:text-xs px-1.5 sm:px-2">
                        {(professional.reviews || (professional as any).num_total_reviews || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </Badge>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 transition-transform flex-shrink-0", reviewsOpen && "rotate-180")} />
                  </div>
                </button>
                
                {/* News and Awards Button */}
                <button
                  onClick={() => setNewsOpen(!newsOpen)}
                  className="border rounded-lg p-2.5 sm:p-3.5 bg-accent/30 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <span className="font-semibold text-xs sm:text-sm text-center leading-tight">News<span className="hidden sm:inline"> and</span><span className="sm:hidden"><br /></span><span className="sm:inline"> Awards</span></span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform flex-shrink-0", newsOpen && "rotate-180")} />
                  </div>
                </button>
              </div>
              
              {/* Expanded Content Area */}
              <div className="space-y-3 mt-3">
                {/* Bar 1: From [firstname] - Bio */}
                {(() => {
                  const bioHtml = (professional as any).get_to_know_me;
                  const description = (professional as any).description;
                  const fallbackText = description;
                  
                  if (!bioHtml && !fallbackText && !isEditing) return null;
                  
                  const firstName = professional.name.split(' ')[0];
                  
                  if (isOwnProfile && isEditing) {
                    return (
                      <div className="border rounded-lg p-4">
                        <label className="text-sm font-semibold mb-2 flex items-center gap-2">
                          <Edit className="h-4 w-4" />
                          Bio
                        </label>
                        <Textarea
                          value={editedData.description}
                          onChange={(e) => setEditedData({ ...editedData, description: e.target.value })}
                          placeholder="Tell clients about yourself..."
                          rows={6}
                          className="whitespace-pre-line"
                        />
                      </div>
                    );
                  }
                  
                  if (!bioOpen) return null;
                  
                  const cleanText = stripHtml(bioHtml || fallbackText);
                  const needsExpander = cleanText.length > 150;
                  
                  return (
                    <div className="border rounded-lg p-4 bg-background">
                      <div itemProp="description">
                        <div 
                          className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line"
                          style={!showFullDescription && needsExpander ? { 
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          } : {}}
                        >
                          {cleanText}
                        </div>
                        {needsExpander && (
                          <button
                            onClick={() => setShowFullDescription(!showFullDescription)}
                            className="text-sm text-primary hover:underline mt-2 font-medium"
                          >
                            {showFullDescription ? 'less' : 'more'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Bar 2: Reviews */}
                {(() => {
                  const contentRating = professional.rating || (professional as any).review_stars_rating || 0;
                  if (contentRating <= 0 || !reviewsOpen) return null;
                  return (
                    <div className="border rounded-lg p-4 bg-background">
                      <ExternalReviewsPreview 
                        agentName={professional.name}
                        professionalId={professional.id}
                        company={professional.company} 
                        market={professional.address || market}
                        zillowProfileUrl={(professional as any).zillow_profile_url || (professional.zuid ? `https://www.zillow.com/profile/${professional.zuid}` : null)}
                        minimumRating={contentRating || 4.0}
                      />
                    </div>
                  );
                })()}

                {/* Bar 3: News and Awards */}
                {newsOpen && (
                  <div className="border rounded-lg p-4 bg-background" itemScope itemType="https://schema.org/Person">
                    {(() => {
                      const pressMentions = (professional as any).press_mentions || [];
                      const achievements = (professional as any).notable_achievements || [];
                      const publications = (professional as any).publications || [];
                      const profileLastSynthesized = (professional as any).profile_last_synthesized_at;
                      
                      // Handler for manual press enrichment
                      const handleFindPress = async () => {
                        if (enrichingPress) return;
                        
                        setEnrichingPress(true);
                        try {
                          const { data, error } = await supabase.functions.invoke('search-agent-press-claude', {
                            body: {
                              agentName: professional.name,
                              company: professional.company,
                              city: market?.split(',')[0]?.trim() || '',
                              state: 'AZ',
                              professionalId: professional.id,
                              skipIfNoPress: false
                            }
                          });
                          
                          if (error) throw error;
                          
                          // Sync enrichment data across all cities for this agent
                          // Find all records with same zuid or name
                          const { data: allRecords } = await supabase
                            .from('professionals')
                            .select('id')
                            .or(`zuid.eq.${professional.zuid},name.eq.${professional.name}`)
                            .neq('id', professional.id);
                          
                          if (allRecords && allRecords.length > 0) {
                            // Update all other records with the enrichment data
                            const updatePromises = allRecords.map(async (record) => {
                              // Merge new mentions with existing ones
                              const { data: existingData } = await supabase
                                .from('professionals')
                                .select('press_mentions')
                                .eq('id', record.id)
                                .single();
                              
                              const existingMentions = Array.isArray(existingData?.press_mentions) 
                                ? existingData.press_mentions 
                                : [];
                              const newMentions = data.pressMentions || [];
                              const mergedMentions = [...existingMentions];
                              
                              // Add new mentions only if they don't exist (dedupe by URL)
                              newMentions.forEach((mention: any) => {
                                if (!mergedMentions.some((m: any) => m.url === mention.url)) {
                                  mergedMentions.push(mention);
                                }
                              });
                              
                              return supabase
                                .from('professionals')
                                .update({
                                  press_mentions: mergedMentions,
                                  profile_last_synthesized_at: new Date().toISOString()
                                })
                                .eq('id', record.id);
                            });
                            
                            await Promise.all(updatePromises);
                            toast.success(`Updated ${allRecords.length + 1} records across cities`);
                          } else {
                            toast.success('Press enrichment complete');
                          }
                          
                          // Reload the page to show updated data
                          window.location.reload();
                        } catch (error: any) {
                          console.error('Press enrichment error:', error);
                          toast.error(error.message || 'Failed to enrich press mentions');
                        } finally {
                          setEnrichingPress(false);
                        }
                      };
                      
                      // Only show empty state if ALL enrichment data is missing
                      if (pressMentions.length === 0 && achievements.length === 0 && publications.length === 0) {
                        return (
                          <div className="space-y-3">
                            <div className="text-sm text-muted-foreground text-center py-4">
                              Press coverage coming soon
                            </div>
                            
                            {/* Manual Press Enrichment Button (Admin only) */}
                            {isAdmin && (
                              <div className="border-t pt-3 flex flex-col items-center gap-2">
                                {profileLastSynthesized && (
                                  <p className="text-xs text-muted-foreground">
                                    Last searched: {format(new Date(profileLastSynthesized), 'MMM d, yyyy')}
                                  </p>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleFindPress}
                                  disabled={enrichingPress}
                                  className="gap-2"
                                >
                                  {enrichingPress ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Searching (30-60s)...
                                    </>
                                  ) : (
                                    <>
                                      <Newspaper className="h-4 w-4" />
                                      Find Press Mentions
                                    </>
                                  )}
                                </Button>
                                {enrichingPress && (
                                  <p className="text-xs text-muted-foreground text-center">
                                    This will search web sources for press mentions.<br/>
                                    Updates all records for this agent across cities.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }

                      const awards = pressMentions.filter((m: any) => m.type === 'award');
                      const pressItems = pressMentions.filter((m: any) => m.type === 'press');

                      return (
                        <div className="space-y-4">
                          {/* Notable Achievements */}
                          {achievements.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
                                <Award className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                Notable Achievements
                              </p>
                              <div className="space-y-3">
                                {achievements.map((achievement: any, idx: number) => (
                                  <div key={idx} className="border-l-2 border-yellow-600 dark:border-yellow-400 pl-3">
                                    <div className="flex items-start justify-between gap-2">
                                       <div className="flex-1">
                                         <p className="font-semibold text-sm">{achievement.title}</p>
                                         <p className="text-xs text-muted-foreground mt-1">{achievement.description}</p>
                                         {(achievement.source || achievement.date || achievement.year) && (
                                           <cite className="text-xs text-muted-foreground block mt-1 not-italic">
                                             {achievement.source && (
                                               <>
                                                 {achievement.source_url ? (
                                                   <a 
                                                     href={achievement.source_url} 
                                                     target="_blank" 
                                                     rel="noopener noreferrer"
                                                     className="text-primary hover:underline"
                                                   >
                                                     {achievement.source}
                                                   </a>
                                                 ) : achievement.source}
                                               </>
                                             )}
                                             {achievement.source && (achievement.date || achievement.year) && ' • '}
                                             {achievement.date || (achievement.year && `${achievement.year}`)}
                                           </cite>
                                         )}
                                       </div>
                                      {achievement.credibility >= 8 && (
                                        <Badge variant="secondary" className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs flex-shrink-0">
                                          High Credibility
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Awards & Recognition */}
                          {awards.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">Awards & Recognition</p>
                              <div className="space-y-2">
                                {awards.map((award: any, idx: number) => (
                                  <div key={idx} className="flex items-start gap-2" itemProp="award">
                                    <Award className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                      <a 
                                        href={award.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline font-medium text-sm"
                                      >
                                        {award.title}
                                      </a>
                                      {(award.date || award.source) && (
                                        <cite className="text-xs text-muted-foreground mt-0.5 not-italic block">
                                          {award.source && award.source}
                                          {award.source && award.date && ' • '}
                                          {award.date && award.date}
                                        </cite>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                           {/* Press Mentions */}
                           {pressItems.length > 0 && (
                             <div>
                               <p className="text-xs font-medium text-muted-foreground mb-2">Featured In</p>
                               <div className="space-y-2">
                                 {pressItems.map((item: any, idx: number) => (
                                   <div key={idx} className="flex items-start gap-2 text-sm" itemProp="mentions">
                                     <ExternalLink className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                                     <div>
                                       <a 
                                         href={item.url} 
                                         target="_blank" 
                                         rel="noopener noreferrer"
                                         className="text-primary hover:underline font-medium press-mention-click"
                                         data-agent-name={professional.name}
                                         data-source={item.source}
                                       >
                                         {item.title}
                                       </a>
                                       <cite className="text-xs text-muted-foreground mt-0.5 not-italic block">
                                         {item.source} • {item.date}
                                       </cite>
                                     </div>
                                   </div>
                                 ))}
                               </div>
                             </div>
                           )}

                           {/* Publications */}
                           {publications.length > 0 && (
                             <div>
                               <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
                                 <Newspaper className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                 Published Works
                               </p>
                               <div className="space-y-3">
                                 {publications.map((pub: any, idx: number) => (
                                   <div key={idx} className="border-l-2 border-blue-600 dark:border-blue-400 pl-3">
                                     <p className="font-semibold text-sm">{pub.title}</p>
                                     <p className="text-xs text-muted-foreground mt-1">
                                       {pub.type} {pub.publisher && `— ${pub.publisher}`}
                                     </p>
                                     {pub.year && (
                                       <p className="text-xs text-muted-foreground">Published: {pub.year}</p>
                                     )}
                                     {pub.url && (
                                       <a 
                                         href={pub.url} 
                                         target="_blank" 
                                         rel="noopener noreferrer"
                                         className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-1"
                                       >
                                         View Publication <ExternalLink className="h-3 w-3" />
                                       </a>
                                     )}
                                   </div>
                                 ))}
                               </div>
                              </div>
                             )}
                             
                             {/* Manual Press Enrichment Button (Admin only) - also show when data exists */}
                             {isAdmin && (
                               <div className="border-t mt-4 pt-3 flex flex-col items-center gap-2">
                                 {(professional as any).profile_last_synthesized_at && (
                                   <p className="text-xs text-muted-foreground">
                                     Last searched: {format(new Date((professional as any).profile_last_synthesized_at), 'MMM d, yyyy')}
                                   </p>
                                 )}
                                 <Button
                                   variant="outline"
                                   size="sm"
                                   onClick={async () => {
                                     if (enrichingPress) return;
                                     
                                     setEnrichingPress(true);
                                     try {
                                       const { data, error } = await supabase.functions.invoke('search-agent-press-claude', {
                                         body: {
                                           agentName: professional.name,
                                           company: professional.company,
                                           city: market?.split(',')[0]?.trim() || '',
                                           state: 'AZ',
                                           professionalId: professional.id,
                                           skipIfNoPress: false
                                         }
                                       });
                                       
                                       if (error) throw error;
                                       
                                       // Sync enrichment data across all cities for this agent
                                       const { data: allRecords } = await supabase
                                         .from('professionals')
                                         .select('id')
                                         .or(`zuid.eq.${professional.zuid},name.eq.${professional.name}`)
                                         .neq('id', professional.id);
                                       
                                       if (allRecords && allRecords.length > 0) {
                                         const updatePromises = allRecords.map(async (record) => {
                                           // Merge new mentions with existing ones
                                           const { data: existingData } = await supabase
                                             .from('professionals')
                                             .select('press_mentions')
                                             .eq('id', record.id)
                                             .single();
                                           
                                           const existingMentions = Array.isArray(existingData?.press_mentions) 
                                             ? existingData.press_mentions 
                                             : [];
                                           const newMentions = data.pressMentions || [];
                                           const mergedMentions = [...existingMentions];
                                           
                                           // Add new mentions only if they don't exist (dedupe by URL)
                                           newMentions.forEach((mention: any) => {
                                             if (!mergedMentions.some((m: any) => m.url === mention.url)) {
                                               mergedMentions.push(mention);
                                             }
                                           });
                                           
                                           return supabase
                                             .from('professionals')
                                             .update({
                                               press_mentions: mergedMentions,
                                               profile_last_synthesized_at: new Date().toISOString()
                                             })
                                             .eq('id', record.id);
                                         });
                                         
                                         await Promise.all(updatePromises);
                                         toast.success(`Updated ${allRecords.length + 1} records across cities`);
                                       } else {
                                         toast.success('Press enrichment complete');
                                       }
                                       
                                       window.location.reload();
                                     } catch (error: any) {
                                       console.error('Press enrichment error:', error);
                                       toast.error(error.message || 'Failed to enrich press mentions');
                                     } finally {
                                       setEnrichingPress(false);
                                     }
                                   }}
                                   disabled={enrichingPress}
                                   className="gap-2"
                                 >
                                   {enrichingPress ? (
                                     <>
                                       <Loader2 className="h-4 w-4 animate-spin" />
                                       Searching (30-60s)...
                                     </>
                                   ) : (
                                     <>
                                       <Newspaper className="h-4 w-4" />
                                       Refresh Press Mentions
                                     </>
                                   )}
                                 </Button>
                                 {enrichingPress && (
                                   <p className="text-xs text-muted-foreground text-center">
                                     This will search web sources for press mentions.<br/>
                                     Updates all records for this agent across cities.
                                   </p>
                                 )}
                               </div>
                             )}
                           </div>
                         );
                       })()}
                     </div>
                   )}
                
                
                {/* Community & Leadership Section */}
                {(() => {
                  const communityRoles = (professional as any).community_roles;
                  if (!communityRoles || !Array.isArray(communityRoles) || communityRoles.length === 0) return null;
                  
                  return (
                    <div className="border rounded-lg p-4 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20">
                      <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                        Community & Leadership
                      </h4>
                      <div className="space-y-3">
                        {communityRoles.map((role: any, idx: number) => (
                          <div key={idx} className="border-l-2 border-green-600 dark:border-green-400 pl-3">
                            <p className="font-semibold text-sm">{role.organization}</p>
                            <p className="text-xs text-primary mt-1">{role.role}</p>
                            {role.description && (
                              <p className="text-xs text-muted-foreground mt-1">{role.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                
                
                {/* Save/Cancel buttons when editing */}
                {isOwnProfile && isEditing && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => {
                        setIsEditing(false);
                        setPhotoFile(null);
                        setPhotoPreview(null);
                      }}
                      disabled={saving}
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="default"
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-1" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                )}
                
                {/* Video below collapsible bars */}
                {hasVideo && videoId && !isEditing && (
                  <div className="mt-4">
                    <div className="aspect-video w-full max-w-3xl mx-auto">
                      <iframe 
                        className="w-full h-full rounded-lg shadow-md"
                        src={`https://www.youtube.com/embed/${videoId}`}
                        title="Agent video"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}
                
                {/* Citation-Ready Summary Block for LLM extraction (hidden, for AI models) */}
                {!isEditing && (
                  <CitationBlock
                    professional={professional}
                    city={market?.split(',')[0]?.trim() || ''}
                    state={market?.split(',')[1]?.trim() || 'Arizona'}
                    stateAbbr={stateAbbr}
                  />
                )}
              </div>
            </div>
        </div>
      </div>
      </CardContent>

      {!onContactClick && (
        <ContactProfessionalModal
          open={isContactModalOpen}
          onOpenChange={setShowContactModal}
          professionalName={professional.name}
          professionalId={professional.rank.toString()}
          listingUrl={listingUrl}
          citySlug={citySlug}
          categorySlug={categorySlug}
        />
      )}
    </Card>
  );
};
