import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle2, AlertCircle, Star, MapPin, Phone, Globe, Award, ChevronDown, ChevronUp, Shield, ShieldCheck, ExternalLink, Loader2, Info, Mail, Home, Building2, Users, TrendingUp, DollarSign, Key, Edit, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { Professional } from "@/types/professional";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";
import { ContactProfessionalModal } from "./ContactProfessionalModal";
import { ExternalReviewsPreview } from "./ExternalReviewsPreview";
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

  // Check if current user owns this profile
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      console.log('Current user:', user?.email, 'Professional email:', professional.email);
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
        
        // Update database if extracted value differs from stored value
        if (bioYears !== professional.years_experience && professional.id) {
          console.log(`[${professional.name}] Updating database: ${bioYears} years`);
          supabase
            .from('professionals')
            .update({ years_experience: bioYears })
            .eq('id', professional.id)
            .then(({ error }) => {
              if (error) {
                console.error(`[${professional.name}] Error updating years_experience:`, error);
              } else {
                console.log(`[${professional.name}] Successfully updated years_experience to ${bioYears}`);
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
                src={photoPreview || professional.image} 
                alt={`${professional.name} - Top professional specializing in ${professional.specialties.slice(0, 3).join(', ')}`}
                className="w-24 h-24 md:w-32 md:h-32 rounded-lg object-cover border-2 border-border"
                itemProp="image"
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
            
            {/* Specialties editor or display */}
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
                
                const dbSpecialties = professional.specialties || [];
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
                   </div>
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
                        <Badge 
                          variant="outline" 
                          className="gap-1.5 text-xs bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 w-fit"
                          title="Verified from state license database"
                        >
                          <ShieldCheck className="h-3 w-3 text-green-600 dark:text-green-400" />
                          Verified
                        </Badge>
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

              {/* Rating - only show if real data exists */}
              {professional.rating > 0 ? (
                <div className="flex items-center gap-2" itemProp="aggregateRating" itemScope itemType="https://schema.org/AggregateRating">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-5 w-5 ${
                          i < Math.floor(professional.rating)
                            ? "fill-primary text-primary"
                            : "text-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-semibold" itemProp="ratingValue">{professional.rating}</span>
                  <span className="text-muted-foreground">(<span itemProp="reviewCount">{professional.reviews.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span> reviews)</span>
                  <meta itemProp="bestRating" content="5" />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span className="text-sm">Rating not yet available</span>
                </div>
              )}


              {/* Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-3 border-y">
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

                  // Use extracted years if available, otherwise fall back to stored value
                  const yearsExperience = extractedYears ?? parsedProfInfo?.yearsInIndustry ?? professional.years_experience ?? null;
                  const hasLicenseVerifiedBadge = ((professional as any).badges || []).includes('License Verified');

                  const displayStats = { totalSales, yearsExperience } as const;
                  const labels: Record<string, string> = {
                    totalSales: 'Total Sales',
                    yearsExperience: 'Years Experience'
                  };

                  return Object.entries(displayStats).map(([key, value]) => (
                    <div key={key} className={cn("text-center md:text-left", key === 'totalSales' && "hidden md:block")}>
                      {isOwnProfile && isEditing ? (
                        <div className="space-y-1">
                          <Input
                            type="number"
                            value={key === 'totalSales' ? editedData.total_sales : editedData.years_experience}
                            onChange={(e) => setEditedData({ 
                              ...editedData, 
                              [key === 'totalSales' ? 'total_sales' : 'years_experience']: parseInt(e.target.value) || 0 
                            })}
                            className="h-8 w-24"
                          />
                          <div className="text-xs text-muted-foreground">{labels[key]}</div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 justify-center md:justify-start">
                            <div className="text-2xl font-bold text-primary">
                              {(value == null || Number(value) <= 0) ? 'NA' : Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            </div>
                            {value != null && Number(value) > 0 && (
                              <span title={key === 'totalSales' ? 'Verified from Zillow data' : 'Verified from license database'}>
                                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{labels[key]}</div>
                        </>
                      )}
                    </div>
                  ));
                })()}
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


              {/* Bio Section - Use get_to_know_me from memo23 if available */}
              {(() => {
                // CRITICAL: Bio text MUST preserve line breaks - use whitespace-pre-line
                const bioHtml = (professional as any).get_to_know_me as string | null;
                const fallbackText = parsedProfInfo?.description || professional.description || '';
                
                if (isOwnProfile && isEditing) {
                  return (
                    <div className="border-t pt-3">
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
                
                if (!bioHtml && !fallbackText) return null;
                
                // Helper to strip HTML tags and decode entities
                const stripHtml = (html: string): string => {
                  // Remove HTML tags
                  const withoutTags = html.replace(/<[^>]*>/g, '');
                  // Decode common HTML entities
                  const textarea = document.createElement('textarea');
                  textarea.innerHTML = withoutTags;
                  return textarea.value;
                };
                
                // Helper to check if text is long enough to need truncation (>150 chars = roughly 3 lines)
                const needsTruncation = (text: string) => text.length > 150;
                
                return (
                  <div itemProp="description" className="border-t pt-3">
                    <h4 className="text-sm font-semibold mb-2">From {professional.name}:</h4>
                    {bioHtml ? (() => {
                      const cleanText = stripHtml(bioHtml);
                      const isTooLong = needsTruncation(cleanText);
                      
                      // CRITICAL: Always preserve line breaks in bios with whitespace-pre-line!
                      return (
                        <>
                          <div 
                            className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line"
                            style={!showFullDescription && isTooLong ? { 
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            } : {}}
                          >
                            {cleanText}
                          </div>
                          {isTooLong && (
                            <button
                              onClick={() => setShowFullDescription(!showFullDescription)}
                              className="text-sm text-primary hover:underline mt-1 font-medium block"
                            >
                              {showFullDescription ? 'less' : 'more'}
                            </button>
                          )}
                        </>
                      );
                    })() : (() => {
                      const cleanFallbackText = stripHtml(fallbackText);
                      const isTooLong = needsTruncation(cleanFallbackText);
                      
                      // CRITICAL: Fallback text - preserve line breaks with whitespace-pre-line
                      return (
                        <>
                          <div 
                            className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line"
                            style={!showFullDescription && isTooLong ? { 
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            } : {}}
                          >
                            {cleanFallbackText}
                          </div>
                          {isTooLong && (
                            <button
                              onClick={() => setShowFullDescription(!showFullDescription)}
                              className="text-sm text-primary hover:underline mt-1 font-medium block"
                            >
                              {showFullDescription ? 'less' : 'more'}
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                );
              })()}

              {/* Contact Information Section */}
              <div>
                <h4 className="sr-only">Contact Information</h4>
                {isOwnProfile && isEditing ? (
                  <div className="space-y-3 pt-3 border-t">
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Website
                      </label>
                      <Input
                        value={editedData.website}
                        onChange={(e) => setEditedData({ ...editedData, website: e.target.value })}
                        placeholder="https://yourwebsite.com"
                        className="max-w-md"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Phone Number
                      </label>
                      <Input
                        value={editedData.phone}
                        onChange={(e) => setEditedData({ ...editedData, phone: e.target.value })}
                        placeholder="(555) 123-4567"
                        className="max-w-md"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </label>
                      <Input
                        value={editedData.email}
                        onChange={(e) => setEditedData({ ...editedData, email: e.target.value })}
                        placeholder="your@email.com"
                        type="email"
                        className="max-w-md"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <ExternalLink className="h-4 w-4" />
                        Zillow Profile URL
                      </label>
                      <Input
                        value={editedData.zillow_profile_url}
                        onChange={(e) => setEditedData({ ...editedData, zillow_profile_url: e.target.value })}
                        placeholder="https://www.zillow.com/profile/..."
                        className="max-w-md"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <a
                      href={(() => {
                        const websiteSource = parsedProfInfo?.websiteUrl || professional.website || '';
                        let v = websiteSource.trim();
                        
                        // If no website, return # to prevent navigation
                        if (!v) return '#';
                        
                        // Fix common malformed patterns
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
                      Visit {professional.name.split(' ')[0]}'s Website
                    </a>
                  </div>
                  {(() => {
                    const phoneDisplay = parsedProfInfo?.phone || professional.phone;
                    if (!phoneDisplay) return null;
                    return (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <a 
                          href={`tel:${phoneDisplay}`} 
                          className="text-primary hover:underline contact-agent-button" 
                          itemProp="telephone"
                          onClick={handlePhoneClick}
                        >
                          {phoneDisplay}
                        </a>
                      </div>
                    );
                  })()}
                   {(() => {
                     const emailDisplay = parsedProfInfo?.email || professional.email;
                     if (!emailDisplay) return null;
                     return (
                       <div className="flex items-center gap-2">
                         <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                         <a 
                           href={`mailto:${emailDisplay}`} 
                           className="text-primary hover:underline" 
                           itemProp="email"
                         >
                           Email
                         </a>
                       </div>
                     );
                   })()}
                   {professional.zuid && (
                     <div className="flex items-center gap-2">
                       <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                       <a
                         href={`https://www.zillow.com/profile/${professional.zuid}`}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="text-primary hover:underline agent-profile-link"
                         onClick={() =>
                           trackEvent('press_mention_click', {
                             agent_name: professional.name,
                             market: professional.address || '',
                             source: 'Zillow Profile',
                           })
                         }
                       >
                         Zillow Profile
                       </a>
                     </div>
                    )}
                  </div>
                )}
              </div>


              {/* Authority Profile Section - MOCKUP with Frank Aazami data */}
              {professional.name === "Frank Aazami" && (
                <div className="pt-4 border-t" itemScope itemType="https://schema.org/Person">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Award className="h-4 w-4 text-primary" />
                      Authority Profile
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFullDescription(!showFullDescription)}
                      className="text-xs"
                    >
                      {showFullDescription ? (
                        <>
                          <ChevronUp className="h-3 w-3 mr-1" />
                          Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3 mr-1" />
                          More
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Awards & Recognition Badges */}
                  <div className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Awards & Recognition</p>
                    <div className="flex flex-wrap gap-2" itemProp="award">
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                        <Award className="h-3 w-3 mr-1" />
                        Phoenix Magazine Top Agent '18-'24
                      </Badge>
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                        <Award className="h-3 w-3 mr-1" />
                        RE/MAX Hall of Fame
                      </Badge>
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                        <Award className="h-3 w-3 mr-1" />
                        Zillow Premier Agent
                      </Badge>
                    </div>
                  </div>

                  {/* Collapsible Detailed Info */}
                  {showFullDescription && (
                    <div className="space-y-3 animate-accordion-down">
                      {/* Media Mentions */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Featured In</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          <a 
                            href="https://www.forbes.com" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                            itemProp="mentions"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Forbes
                          </a>
                          <a 
                            href="https://www.azcentral.com" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                            itemProp="mentions"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Arizona Republic
                          </a>
                          <a 
                            href="https://www.bizjournals.com/phoenix" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                            itemProp="mentions"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Phoenix Business Journal
                          </a>
                        </div>
                      </div>

                      {/* Professional Affiliations */}
                      <div itemProp="memberOf" itemScope itemType="https://schema.org/Organization">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Professional Memberships</p>
                        <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                          <li itemProp="name">Luxury Home Council</li>
                          <li itemProp="name">Institute for Luxury Home Marketing</li>
                        </ul>
                      </div>

                      {/* Community Involvement */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Community Leadership</p>
                        <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                          <li itemProp="affiliation">Phoenix Children's Hospital Foundation Board</li>
                          <li itemProp="affiliation">Arizona Humane Society Supporter</li>
                        </ul>
                      </div>

                      {/* Career Stats for LLM visibility */}
                      <div className="pt-2 border-t">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Career Highlights</p>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div itemProp="hasOccupation" itemScope itemType="https://schema.org/Occupation">
                            <span className="text-muted-foreground">Career Sales:</span>
                            <span className="font-semibold ml-1" itemProp="estimatedSalary">$500M+</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Avg Sale Price:</span>
                            <span className="font-semibold ml-1">$2.5M</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Specialty:</span>
                            <span className="font-semibold ml-1" itemProp="knowsAbout">Luxury Real Estate</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Contact Button or Save/Cancel when editing */}
              <div className="pt-4 border-t">
                {isOwnProfile && isEditing ? (
                  <div className="flex gap-2">
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
                ) : (
                  <Button 
                    onClick={() => {
                      trackEvent('contact_cta_click', {
                        agent_name: professional.name,
                        market: market,
                        agent_type: agentType
                      });
                      
                      if (onContactClick) {
                        // Use parent's contact handling
                        onContactClick();
                      } else {
                        // Fallback to local modal
                        setShowContactModal(true);
                      }
                    }}
                    className="w-full"
                    variant="default"
                  >
                    Contact {professional.name.split(' ')[0]}
                  </Button>
                )}
              </div>

              {/* External reviews preview (Google/Yelp/Facebook) */}
              <ExternalReviewsPreview 
                agentName={professional.name}
                professionalId={professional.id}
                company={professional.company} 
                market={professional.address || market}
                zillowProfileUrl={(professional as any).zillow_profile_url || (professional.zuid ? `https://www.zillow.com/profile/${professional.zuid}` : null)}
                minimumRating={professional.rating || 4.0}
              />


            </div>
          </div>
          
          {/* Video Column - responsive width, only if video exists */}
          {hasVideo && videoId && !isEditing && (
            <div className="flex-shrink-0 w-full md:w-auto order-first md:order-last mt-4 md:mt-0">
              <div className="aspect-video w-full md:w-64 lg:w-80 xl:w-[360px]">
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
