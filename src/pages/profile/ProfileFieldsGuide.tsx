import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Pencil, Upload, ArrowRight, ArrowLeft, User, Building2, Star, Phone, Mail, Globe, FileText, Award, MapPin, Image, Video, Trophy, MessageSquarePlus, Facebook, Twitter, Instagram } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import FieldEditModal from "@/components/profile/FieldEditModal";
import ImageUploadModal from "@/components/profile/ImageUploadModal";
import FieldReviewRequestModal from "@/components/profile/FieldReviewRequestModal";
import SpecialtyEditModal from "@/components/profile/SpecialtyEditModal";
import AwardEditModal from "@/components/profile/AwardEditModal";
import PressMentionEditModal from "@/components/profile/PressMentionEditModal";
import { Badge } from "@/components/ui/badge";

// TikTok icon component (lucide doesn't have one)
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

interface Professional {
  id: string;
  name: string;
  company?: string;
  review_stars_rating?: number;
  num_total_reviews?: number;
  image_url?: string;
  sidebar_video_url?: string;
  phone?: string;
  email?: string;
  website?: string;
  description?: string;
  synthesized_bio?: string;
  specialty?: string[];
  notable_achievements?: any[];
  press_mentions?: any[];
  address?: string;
  years_experience?: number;
  total_sales?: number;
  license_number?: string;
  verification_token?: string;
  social_facebook?: string;
  social_twitter?: string;
  social_instagram?: string;
  social_tiktok?: string;
}

interface FieldConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
  editable: boolean;
  description: string;
  type: 'text' | 'textarea' | 'image' | 'video' | 'readonly' | 'array';
  requiresReview?: boolean;
}

// Helper function to strip HTML tags
const stripHtmlTags = (html: string): string => {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, '').trim();
};

// Helper component for text with show more/less functionality
const TextWithShowMore = ({ 
  value, 
  fieldKey, 
  expandedFields, 
  setExpandedFields 
}: { 
  value: string; 
  fieldKey: string; 
  expandedFields: Set<string>; 
  setExpandedFields: React.Dispatch<React.SetStateAction<Set<string>>> 
}) => {
  const cleanValue = stripHtmlTags(value || "");
  const isLong = cleanValue.length > 200;
  const isExpanded = expandedFields.has(fieldKey);
  
  const toggleExpand = () => {
    setExpandedFields(prev => {
      const next = new Set(prev);
      if (isExpanded) {
        next.delete(fieldKey);
      } else {
        next.add(fieldKey);
      }
      return next;
    });
  };

  if (!cleanValue || cleanValue === "Not set") {
    return <span className="text-muted-foreground italic">Not set</span>;
  }

  if (!isLong) {
    return <span className="whitespace-pre-line">{cleanValue}</span>;
  }

  return (
    <span className="whitespace-pre-line">
      {isExpanded ? cleanValue : cleanValue.substring(0, 200)}
      <span 
        onClick={toggleExpand}
        className="text-primary cursor-pointer hover:underline ml-1"
      >
        {isExpanded ? " less" : "...more"}
      </span>
    </span>
  );
};

const ProfileFieldsGuide = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<Professional | null>(null);
  
  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [specialtyModalOpen, setSpecialtyModalOpen] = useState(false);
  const [awardModalOpen, setAwardModalOpen] = useState(false);
  const [pressMentionModalOpen, setPressMentionModalOpen] = useState(false);
  const [currentField, setCurrentField] = useState<FieldConfig | null>(null);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [communicationConsent, setCommunicationConsent] = useState(false);

  const fields: FieldConfig[] = [
    {
      key: "name",
      label: "Name",
      icon: <User className="h-5 w-5" />,
      editable: false,
      description: "Your name is verified through our research process.",
      type: 'readonly',
      requiresReview: true
    },
    {
      key: "company",
      label: "Brokerage",
      icon: <Building2 className="h-5 w-5" />,
      editable: true,
      description: "Your brokerage affiliation.",
      type: 'text'
    },
    {
      key: "review_stars_rating",
      label: "Rating",
      icon: <Star className="h-5 w-5" />,
      editable: false,
      description: "Auto-synced from verified sources.",
      type: 'readonly',
      requiresReview: true
    },
    {
      key: "num_total_reviews",
      label: "Reviews",
      icon: <Star className="h-5 w-5" />,
      editable: false,
      description: "Auto-synced from verified sources.",
      type: 'readonly',
      requiresReview: true
    },
    {
      key: "image_url",
      label: "Profile Photo",
      icon: <Image className="h-5 w-5" />,
      editable: true,
      description: "Upload a professional headshot.",
      type: 'image'
    },
    {
      key: "sidebar_video_url",
      label: "Video Introduction",
      icon: <Video className="h-5 w-5" />,
      editable: true,
      description: "Add a video URL to introduce yourself.",
      type: 'text'
    },
    {
      key: "phone",
      label: "Phone Number",
      icon: <Phone className="h-5 w-5" />,
      editable: true,
      description: "Your contact phone number.",
      type: 'text'
    },
    {
      key: "email",
      label: "Email Address",
      icon: <Mail className="h-5 w-5" />,
      editable: true,
      description: "Your business email.",
      type: 'text'
    },
    {
      key: "website",
      label: "Website",
      icon: <Globe className="h-5 w-5" />,
      editable: true,
      description: "Your personal website or landing page.",
      type: 'text'
    },
    {
      key: "description",
      label: "Bio (Your Version)",
      icon: <FileText className="h-5 w-5" />,
      editable: true,
      description: "We suggest that you write this in the first person using I or We.",
      type: 'textarea'
    },
    {
      key: "synthesized_bio",
      label: "Bio (Our Synthesis)",
      icon: <FileText className="h-5 w-5" />,
      editable: false,
      description: "Our AI-generated bio based on research. Request review to change.",
      type: 'textarea',
      requiresReview: true
    },
    {
      key: "specialty",
      label: "Specialties",
      icon: <Award className="h-5 w-5" />,
      editable: true,
      description: "Your areas of expertise.",
      type: 'array'
    },
    {
      key: "notable_achievements",
      label: "Awards & Achievements",
      icon: <Trophy className="h-5 w-5" />,
      editable: true,
      description: "Your awards and certifications.",
      type: 'array'
    },
    {
      key: "press_mentions",
      label: "Press Mentions",
      icon: <FileText className="h-5 w-5" />,
      editable: true,
      description: "Media coverage and press mentions.",
      type: 'array'
    },
    {
      key: "social_facebook",
      label: "Facebook",
      icon: <Facebook className="h-5 w-5" />,
      editable: true,
      description: "Your Facebook profile URL.",
      type: 'text'
    },
    {
      key: "social_twitter",
      label: "X (Twitter)",
      icon: <Twitter className="h-5 w-5" />,
      editable: true,
      description: "Your X (Twitter) profile URL.",
      type: 'text'
    },
    {
      key: "social_instagram",
      label: "Instagram",
      icon: <Instagram className="h-5 w-5" />,
      editable: true,
      description: "Your Instagram profile URL.",
      type: 'text'
    },
    {
      key: "social_tiktok",
      label: "TikTok",
      icon: <TikTokIcon className="h-5 w-5" />,
      editable: true,
      description: "Your TikTok profile URL.",
      type: 'text'
    },
    {
      key: "years_experience",
      label: "Years Experience",
      icon: <MapPin className="h-5 w-5" />,
      editable: false,
      description: "Auto-calculated from your license date.",
      type: 'readonly',
      requiresReview: true
    },
    {
      key: "total_sales",
      label: "Total Sales",
      icon: <MapPin className="h-5 w-5" />,
      editable: false,
      description: "Auto-synced from verified sources.",
      type: 'readonly',
      requiresReview: true
    },
    {
      key: "license_number",
      label: "License Number",
      icon: <MapPin className="h-5 w-5" />,
      editable: false,
      description: "Your verified license number.",
      type: 'readonly',
      requiresReview: true
    }
  ];

  useEffect(() => {
    const fetchProfessional = async () => {
      if (!token) return;
      try {
        // First try to find by verification_token
        let { data, error } = await supabase
          .from("professionals")
          .select("*")
          .eq("verification_token", token)
          .maybeSingle();
        
        // If not found and token looks like UUID, try by id
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
        if (!data && !error && isUUID) {
          const fallback = await supabase
            .from("professionals")
            .select("*")
            .eq("id", token)
            .maybeSingle();
          data = fallback.data;
          error = fallback.error;
        }
        
        if (error) throw error;
        if (!data) {
          navigate("/");
          return;
        }
        setProfessional(data as any);
      } catch (error) {
        console.error("Error fetching professional:", error);
        navigate("/");
      } finally {
        setLoading(false);
      }
    };
    fetchProfessional();
  }, [token, navigate]);

  const getFieldValue = (field: FieldConfig): string => {
    if (!professional) return "N/A";
    const value = (professional as any)[field.key];
    
    if (value === null || value === undefined) return "Not set";
    
    if (field.type === 'array') {
      if (Array.isArray(value)) {
        if (value.length === 0) return "None";
        if (typeof value[0] === 'object') {
          return value.map((item: any) => item.title || item.name || JSON.stringify(item)).join(", ");
        }
        return value.join(", ");
      }
      return "None";
    }
    
    if (field.key === 'review_stars_rating') {
      return value ? `${value} stars` : "Not set";
    }
    
    return String(value);
  };

  const handleEditClick = (field: FieldConfig) => {
    setCurrentField(field);
    if (field.key === 'specialty') {
      setSpecialtyModalOpen(true);
    } else if (field.key === 'notable_achievements') {
      setAwardModalOpen(true);
    } else if (field.key === 'press_mentions') {
      setPressMentionModalOpen(true);
    } else if (field.type === 'image') {
      setImageModalOpen(true);
    } else if (field.requiresReview) {
      setReviewModalOpen(true);
    } else {
      setEditModalOpen(true);
    }
  };

  const handleSaveSpecialties = async (newSpecialties: string[]) => {
    if (!professional) return;
    
    // Save specialties directly to database via edge function
    try {
      const { data, error } = await supabase.functions.invoke('update-professional-field', {
        body: {
          token,
          field: 'specialty',
          value: newSpecialties
        }
      });

      if (error) throw error;

      setProfessional(prev => prev ? { ...prev, specialty: newSpecialties } : null);
      
      toast({
        title: "Specialties Saved",
        description: "Your specialties have been saved successfully."
      });
    } catch (error: any) {
      console.error("Error saving specialties:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save specialties.",
        variant: "destructive"
      });
    }
  };

  const handleSaveAwards = async (awards: any[]) => {
    if (!professional) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('update-professional-field', {
        body: {
          token,
          field: 'notable_achievements',
          value: awards
        }
      });

      if (error) throw error;

      setProfessional(prev => prev ? { ...prev, notable_achievements: awards } : null);
      
      toast({
        title: "Awards Saved",
        description: "Your awards have been saved successfully."
      });
    } catch (error: any) {
      console.error("Error saving awards:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save awards.",
        variant: "destructive"
      });
    }
  };

  const handleSavePressMentions = async (mentions: any[]) => {
    if (!professional) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('update-professional-field', {
        body: {
          token,
          field: 'press_mentions',
          value: mentions
        }
      });

      if (error) throw error;

      setProfessional(prev => prev ? { ...prev, press_mentions: mentions } : null);
      
      toast({
        title: "Press Mentions Saved",
        description: "Your press mentions have been saved successfully."
      });
    } catch (error: any) {
      console.error("Error saving press mentions:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save press mentions.",
        variant: "destructive"
      });
    }
  };

  const handleSaveField = async (newValue: string) => {
    if (!currentField || !professional) return;
    
    const oldValue = getFieldValue(currentField);
    
    // Save field directly to database via edge function (bypasses RLS)
    try {
      const { data, error } = await supabase.functions.invoke('update-professional-field', {
        body: {
          token,
          field: currentField.key,
          value: newValue
        }
      });

      if (error) throw error;

      // Update local state
      setProfessional(prev => prev ? { ...prev, [currentField.key]: newValue } : null);
      
      toast({
        title: "Field Saved",
        description: `${currentField.label} has been saved successfully.`
      });
    } catch (error: any) {
      console.error("Error saving field:", error);
      toast({
        title: "Error Saving",
        description: error.message || `Failed to save ${currentField.label}.`,
        variant: "destructive"
      });
    }
  };

  const handleSaveImage = async (imageUrl: string) => {
    if (!currentField || !professional) return;
    
    // Save image directly to database via edge function (bypasses RLS for magic link users)
    try {
      const { data, error } = await supabase.functions.invoke('update-professional-field', {
        body: {
          token,
          field: currentField.key,
          value: imageUrl
        }
      });

      if (error) throw error;

      // Update local state
      setProfessional(prev => prev ? { ...prev, [currentField.key]: imageUrl } : null);
      
      toast({
        title: "Image Saved",
        description: "Your photo has been saved successfully."
      });
    } catch (error: any) {
      console.error("Error saving image:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save image to database.",
        variant: "destructive"
      });
    }
  };

  const handleContinue = () => {
    navigate(`/profile/${token}/pricing`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const editableFields = fields.filter(f => f.editable);
  const readOnlyFields = fields.filter(f => !f.editable);

  return (
    <>
      <Helmet>
        <title>Edit Your Profile | Top10Lists.us</title>
        <meta name="description" content="Edit your Top10Lists profile information" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Back Button */}
          <Button 
            variant="ghost" 
            onClick={() => navigate(`/profile/${token}`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Listing Preview
          </Button>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Edit Your Profile
            </h1>
            <p className="text-lg text-muted-foreground">
              Click "Edit" next to any field to update it. Changes save automatically.
            </p>
            {professional?.name && (
              <p className="text-primary font-medium mt-2">{professional.name}</p>
            )}
          </div>

          {/* Editable Fields Section */}
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Editable Fields
              </h2>
              <div className="space-y-3">
                {editableFields.map((field) => (
                  <div key={field.key} className="flex items-start gap-3 p-4 rounded-lg bg-background/80 border border-border/50">
                    <div className="text-primary mt-0.5 shrink-0">{field.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-foreground">{field.label}</p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditClick(field)}
                          className="shrink-0"
                        >
                          {field.type === 'image' ? (
                            <>
                              <Upload className="h-4 w-4 mr-1" />
                              Upload
                            </>
                          ) : (
                            <>
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
                      <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                        {field.type === 'image' && (professional as any)[field.key] ? (
                          <img 
                            src={(professional as any)[field.key]} 
                            alt={field.label}
                            className="w-16 h-16 object-cover rounded"
                          />
                        ) : field.type === 'array' ? (
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray((professional as any)[field.key]) && (professional as any)[field.key].length > 0 ? (
                              (professional as any)[field.key].slice(0, 5).map((item: any, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {typeof item === 'string' ? item : item.title || item.name || 'Item'}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground italic">Not set</span>
                            )}
                            {Array.isArray((professional as any)[field.key]) && (professional as any)[field.key].length > 5 && (
                              <Badge variant="outline" className="text-xs">+{(professional as any)[field.key].length - 5} more</Badge>
                            )}
                          </div>
                        ) : (() => {
                          // Inline text with expand/collapse - v2
                          const rawVal = getFieldValue(field);
                          const cleanVal = rawVal.replace(/<[^>]*>/g, '').trim();
                          const needsExpand = cleanVal.length > 200;
                          const isExpanded = expandedFields.has(field.key);
                          
                          if (!cleanVal || cleanVal === "Not set") {
                            return <span className="text-muted-foreground italic">Not set</span>;
                          }
                          
                          return (
                            <span className="whitespace-pre-line">
                              {needsExpand && !isExpanded ? cleanVal.slice(0, 200) : cleanVal}
                              {needsExpand && (
                                <span 
                                  onClick={() => setExpandedFields(prev => {
                                    const next = new Set(prev);
                                    isExpanded ? next.delete(field.key) : next.add(field.key);
                                    return next;
                                  })}
                                  className="text-primary cursor-pointer hover:underline font-medium ml-1"
                                >
                                  {isExpanded ? "less" : "...more"}
                                </span>
                              )}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Read-Only Fields Section */}
          <Card className="mb-8 border-muted bg-muted/30">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Auto-Synced Fields
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                In order to be reliably cited by AI, we have to verify some information through third parties. If something is wrong, just ask us to review it.
              </p>
              <div className="space-y-3">
                {readOnlyFields.map((field) => {
                  const rawVal = getFieldValue(field);
                  const cleanVal = rawVal.replace(/<[^>]*>/g, '').trim();
                  const needsExpand = cleanVal.length > 200;
                  const isExpanded = expandedFields.has(field.key);
                  
                  return (
                    <div key={field.key} className="flex items-start gap-3 p-4 rounded-lg bg-background/50 border border-border/30">
                      <div className="text-muted-foreground mt-0.5 shrink-0">{field.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-foreground">{field.label}</p>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditClick(field)}
                            className="shrink-0 text-muted-foreground"
                          >
                            <MessageSquarePlus className="h-4 w-4 mr-1" />
                            Request Review
                          </Button>
                        </div>
                        <div className="mt-2 p-2 bg-muted/30 rounded text-sm">
                          {!cleanVal || cleanVal === "Not set" ? (
                            <span className="text-muted-foreground italic">Not set</span>
                          ) : (
                            <span className="whitespace-pre-line">
                              {needsExpand && !isExpanded ? cleanVal.slice(0, 200) : cleanVal}
                              {needsExpand && (
                                <span 
                                  onClick={() => setExpandedFields(prev => {
                                    const next = new Set(prev);
                                    isExpanded ? next.delete(field.key) : next.add(field.key);
                                    return next;
                                  })}
                                  className="text-primary cursor-pointer hover:underline font-medium ml-1"
                                >
                                  {isExpanded ? "less" : "...more"}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Communication Consent */}
          <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-lg border">
            <Checkbox
              id="communicationConsent"
              checked={communicationConsent}
              onCheckedChange={(checked) => setCommunicationConsent(checked === true)}
              className="mt-1"
            />
            <Label htmlFor="communicationConsent" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
              We will send you periodic updates by mail and text. Please check the box to say you understand.
            </Label>
          </div>

          {/* CTA Buttons */}
          <div className="flex justify-between items-center">
            <Button variant="ghost" onClick={() => navigate(`/profile/${token}`)}>
              Back to Preview
            </Button>
            <Button size="lg" onClick={handleContinue} disabled={!communicationConsent} className="gap-2 px-8">
              Continue
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {currentField && (
        <FieldEditModal
          open={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setCurrentField(null);
          }}
          onSave={handleSaveField}
          fieldLabel={currentField.label}
          fieldKey={currentField.key}
          currentValue={getFieldValue(currentField)}
          isTextarea={currentField.type === 'textarea'}
          placeholder={`Enter ${currentField.label.toLowerCase()}`}
        />
      )}

      {/* Image Upload Modal */}
      {currentField && professional && (
        <ImageUploadModal
          open={imageModalOpen}
          onClose={() => {
            setImageModalOpen(false);
            setCurrentField(null);
          }}
          onSave={handleSaveImage}
          fieldLabel={currentField.label}
          currentImageUrl={(professional as any)[currentField.key]}
          professionalId={professional.id}
        />
      )}

      {/* Review Request Modal */}
      {currentField && professional && (
        <FieldReviewRequestModal
          open={reviewModalOpen}
          onOpenChange={(open) => {
            setReviewModalOpen(open);
            if (!open) setCurrentField(null);
          }}
          fieldName={currentField.label}
          profileLink={`https://top10lists.us/profile/${token}`}
          professionalName={professional.name}
          professionalEmail={professional.email}
        />
      )}

      {/* Specialty Edit Modal */}
      {professional && (
        <SpecialtyEditModal
          open={specialtyModalOpen}
          onClose={() => {
            setSpecialtyModalOpen(false);
            setCurrentField(null);
          }}
          onSave={handleSaveSpecialties}
          currentSpecialties={professional.specialty || []}
        />
      )}

      {/* Award Edit Modal */}
      {professional && (
        <AwardEditModal
          open={awardModalOpen}
          onClose={() => {
            setAwardModalOpen(false);
            setCurrentField(null);
          }}
          onSave={handleSaveAwards}
          currentAwards={professional.notable_achievements || []}
        />
      )}

      {/* Press Mention Edit Modal */}
      {professional && (
        <PressMentionEditModal
          open={pressMentionModalOpen}
          onClose={() => {
            setPressMentionModalOpen(false);
            setCurrentField(null);
          }}
          onSave={handleSavePressMentions}
          currentMentions={professional.press_mentions || []}
        />
      )}
    </>
  );
};

export default ProfileFieldsGuide;
