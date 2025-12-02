import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Pencil, Upload, ArrowRight, User, Building2, Star, Phone, Mail, Globe, FileText, Award, MapPin, Image, Video, Trophy, MessageSquarePlus, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import FieldEditModal from "@/components/profile/FieldEditModal";
import ImageUploadModal from "@/components/profile/ImageUploadModal";
import FieldReviewRequestModal from "@/components/profile/FieldReviewRequestModal";
import SpecialtyEditModal from "@/components/profile/SpecialtyEditModal";
import { Badge } from "@/components/ui/badge";

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
}

interface ChangeHistoryItem {
  fieldKey: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
  timestamp: Date;
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

const ProfileFieldsGuide = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [professional, setProfessional] = useState<Professional | null>(null);
  
  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [specialtyModalOpen, setSpecialtyModalOpen] = useState(false);
  const [currentField, setCurrentField] = useState<FieldConfig | null>(null);
  
  // Change history
  const [changeHistory, setChangeHistory] = useState<ChangeHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

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
      description: "Your personal bio - you can edit this freely.",
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
    
    const oldValue = getFieldValue(fields.find(f => f.key === 'specialty')!);
    const newValue = newSpecialties.join(", ");
    
    setChangeHistory(prev => [...prev, {
      fieldKey: 'specialty',
      fieldLabel: 'Specialties',
      oldValue,
      newValue,
      timestamp: new Date()
    }]);

    setProfessional(prev => prev ? { ...prev, specialty: newSpecialties } : null);
    
    toast({
      title: "Specialties Updated",
      description: "Your specialties have been updated. Remember to save all changes."
    });
  };

  const handleSaveField = async (newValue: string) => {
    if (!currentField || !professional) return;
    
    const oldValue = getFieldValue(currentField);
    
    setChangeHistory(prev => [...prev, {
      fieldKey: currentField.key,
      fieldLabel: currentField.label,
      oldValue,
      newValue,
      timestamp: new Date()
    }]);

    setProfessional(prev => prev ? { ...prev, [currentField.key]: newValue } : null);
    
    toast({
      title: "Field Updated",
      description: `${currentField.label} has been updated. Remember to save all changes.`
    });
  };

  const handleSaveImage = async (imageUrl: string) => {
    if (!currentField || !professional) return;
    
    // Save image directly to database (don't wait for "Save All Changes")
    try {
      const { error } = await supabase
        .from("professionals")
        .update({ [currentField.key]: imageUrl })
        .eq("id", professional.id);

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

  const handleSaveAllChanges = async () => {
    if (!professional || changeHistory.length === 0) {
      toast({
        title: "No Changes",
        description: "You haven't made any changes yet."
      });
      return;
    }

    setSaving(true);
    try {
      const updates: Record<string, any> = {};
      changeHistory.forEach(change => {
        updates[change.fieldKey] = (professional as any)[change.fieldKey];
      });

      const { error } = await supabase
        .from("professionals")
        .update(updates)
        .eq("id", professional.id);

      if (error) throw error;

      supabase.functions.invoke('track-profile-event', {
        body: { 
          token, 
          event_name: 'profile_fields_edited',
          event_data: { 
            fields_changed: changeHistory.map(c => c.fieldKey),
            change_count: changeHistory.length
          }
        }
      });

      toast({
        title: "Changes Saved",
        description: `${changeHistory.length} field(s) updated successfully.`
      });

      setChangeHistory([]);
      
    } catch (error: any) {
      console.error("Error saving changes:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save changes.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = async () => {
    if (changeHistory.length > 0) {
      await handleSaveAllChanges();
    }
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
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Edit Your Profile
            </h1>
            <p className="text-lg text-muted-foreground">
              Click "Edit" next to any field to update it. Changes are saved when you click "Save All Changes".
            </p>
            {professional?.name && (
              <p className="text-primary font-medium mt-2">{professional.name}</p>
            )}
          </div>

          {/* Change History Banner */}
          {changeHistory.length > 0 && (
            <Card className="mb-6 border-amber-500/50 bg-amber-500/10">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-amber-600" />
                    <span className="font-medium text-foreground">
                      {changeHistory.length} unsaved change{changeHistory.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowHistory(!showHistory)}
                    >
                      {showHistory ? "Hide" : "Show"} Details
                    </Button>
                    <Button 
                      size="sm"
                      onClick={handleSaveAllChanges}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Save All Changes
                    </Button>
                  </div>
                </div>
                
                {showHistory && (
                  <div className="mt-4 space-y-2">
                    {changeHistory.map((change, idx) => (
                      <div key={idx} className="text-sm p-2 bg-background/50 rounded">
                        <span className="font-medium">{change.fieldLabel}:</span>
                        <span className="text-muted-foreground"> "{change.oldValue.substring(0, 50)}{change.oldValue.length > 50 ? '...' : ''}" → </span>
                        <span className="text-primary">"{change.newValue.substring(0, 50)}{change.newValue.length > 50 ? '...' : ''}"</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
                        ) : (
                          <span className={!getFieldValue(field) || getFieldValue(field) === "Not set" ? "text-muted-foreground italic" : "whitespace-pre-line"}>
                            {getFieldValue(field).length > 200 ? getFieldValue(field).substring(0, 200) + "..." : getFieldValue(field)}
                          </span>
                        )}
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
                These fields are verified through our research. Click "Request Review" to request changes.
              </p>
              <div className="space-y-3">
                {readOnlyFields.map((field) => (
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
                        <span className={!getFieldValue(field) || getFieldValue(field) === "Not set" ? "text-muted-foreground italic" : "whitespace-pre-line"}>
                          {getFieldValue(field).length > 200 ? getFieldValue(field).substring(0, 200) + "..." : getFieldValue(field)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* CTA Buttons */}
          <div className="flex justify-between items-center">
            <Button variant="ghost" onClick={() => navigate(`/profile/${token}`)}>
              Back to Preview
            </Button>
            <Button size="lg" onClick={handleContinue} className="gap-2 px-8">
              {changeHistory.length > 0 ? "Save & Continue" : "Continue"}
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
    </>
  );
};

export default ProfileFieldsGuide;
