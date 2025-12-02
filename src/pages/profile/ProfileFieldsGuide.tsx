import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, ArrowRight, User, Building2, Star, Phone, Mail, Globe, FileText, Award, MapPin, Image, Video, Trophy } from "lucide-react";

interface Professional {
  id: string;
  name: string;
}

interface FieldInfo {
  label: string;
  icon: React.ReactNode;
  editable: boolean;
  description: string;
}

const ProfileFieldsGuide = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<Professional | null>(null);

  useEffect(() => {
    const fetchProfessional = async () => {
      if (!token) return;
      try {
        // First try to find by verification_token (primary lookup for magic links)
        let { data, error } = await supabase
          .from("professionals")
          .select("id, name")
          .eq("verification_token", token)
          .maybeSingle();
        
        // If not found by verification_token and token looks like UUID, try by id
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
        if (!data && !error && isUUID) {
          const fallback = await supabase
            .from("professionals")
            .select("id, name")
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
        setProfessional(data);
      } catch (error) {
        console.error("Error fetching professional:", error);
        navigate("/");
      } finally {
        setLoading(false);
      }
    };
    fetchProfessional();
  }, [token, navigate]);

  const fields: FieldInfo[] = [
    {
      label: "Name",
      icon: <User className="h-5 w-5" />,
      editable: false,
      description: "Your name is verified through our research process and cannot be changed here."
    },
    {
      label: "Brokerage",
      icon: <Building2 className="h-5 w-5" />,
      editable: true,
      description: "Update your brokerage affiliation to reflect your current company."
    },
    {
      label: "Rating & Reviews",
      icon: <Star className="h-5 w-5" />,
      editable: false,
      description: "Your rating and review count are automatically synced from verified sources."
    },
    {
      label: "Profile Photo",
      icon: <Image className="h-5 w-5" />,
      editable: true,
      description: "Upload a professional headshot to make a great first impression."
    },
    {
      label: "Video Introduction",
      icon: <Video className="h-5 w-5" />,
      editable: true,
      description: "Add a video to introduce yourself and showcase your personality."
    },
    {
      label: "Phone Number",
      icon: <Phone className="h-5 w-5" />,
      editable: true,
      description: "Update your preferred contact phone number for potential clients."
    },
    {
      label: "Email Address",
      icon: <Mail className="h-5 w-5" />,
      editable: true,
      description: "Set your business email where you'd like to receive inquiries."
    },
    {
      label: "Website",
      icon: <Globe className="h-5 w-5" />,
      editable: true,
      description: "Add or update your personal website or landing page URL."
    },
    {
      label: "Bio / Description",
      icon: <FileText className="h-5 w-5" />,
      editable: true,
      description: "Customize your professional bio to highlight your expertise and approach."
    },
    {
      label: "Specialties",
      icon: <Award className="h-5 w-5" />,
      editable: true,
      description: "Select the specialties that best represent your areas of focus."
    },
    {
      label: "Awards & Achievements",
      icon: <Trophy className="h-5 w-5" />,
      editable: true,
      description: "Add awards, certifications, and notable achievements to build credibility."
    },
    {
      label: "Press Mentions",
      icon: <FileText className="h-5 w-5" />,
      editable: true,
      description: "Include media coverage and press mentions that highlight your expertise."
    },
    {
      label: "Service Areas",
      icon: <MapPin className="h-5 w-5" />,
      editable: false,
      description: "Your service areas are determined by your profile and subscription cities."
    }
  ];

  const editableFields = fields.filter(f => f.editable);
  const readOnlyFields = fields.filter(f => !f.editable);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Profile Fields Guide | Top10Lists.us</title>
        <meta name="description" content="Learn which fields you can edit on your Top10Lists profile" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Your Profile Fields
            </h1>
            <p className="text-lg text-muted-foreground">
              We're all about accuracy. Tune your profile so it best represents who you are and what you've done. This is a free listing. You can <a href="/about/ranking-methodology" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">click here</a> to see how we have selected you.
            </p>
          </div>

          {/* Editable Fields Section */}
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">
                  Fields You Can Edit
                </h2>
              </div>
              <p className="text-muted-foreground mb-4">
                These fields are fully customizable to help you stand out:
              </p>
              <div className="space-y-3">
                {editableFields.map((field, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-background/80 border border-border/50">
                    <div className="text-primary mt-0.5">{field.icon}</div>
                    <div>
                      <p className="font-medium text-foreground">{field.label}</p>
                      <p className="text-sm text-muted-foreground">{field.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Read-Only Fields Section */}
          <Card className="mb-8 border-muted bg-muted/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <XCircle className="h-6 w-6 text-muted-foreground" />
                <h2 className="text-xl font-semibold text-foreground">
                  Auto-Synced Fields
                </h2>
              </div>
              <p className="text-muted-foreground mb-4">
                These fields are verified through our research and kept accurate automatically:
              </p>
              <div className="space-y-3">
                {readOnlyFields.map((field, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/30">
                    <div className="text-muted-foreground mt-0.5">{field.icon}</div>
                    <div>
                      <p className="font-medium text-foreground">{field.label}</p>
                      <p className="text-sm text-muted-foreground">{field.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* CTA Button */}
          <div className="flex justify-center">
            <Button size="lg" onClick={() => navigate(`/profile/${token}/edit`)} className="gap-2 px-8 py-6 text-lg">
              Next
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfileFieldsGuide;
