import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Phone, Mail, Globe, Award } from "lucide-react";
import { Helmet } from "react-helmet";

interface Professional {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  image_url: string | null;
  specialty: string[];
  years_experience: number | null;
  description: string | null;
  cities: { name: string; state: string } | null;
  categories: { name: string } | null;
}

export default function VerifyAgentListing() {
  const { professionalId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [formData, setFormData] = useState({
    phone: "",
    email: "",
    website: "",
    description: "",
  });

  useEffect(() => {
    fetchProfessional();
  }, [professionalId]);

  const fetchProfessional = async () => {
    try {
      const { data, error } = await supabase
        .from("professionals")
        .select(`
          id,
          name,
          company,
          phone,
          email,
          website,
          image_url,
          specialty,
          years_experience,
          description,
          cities (name, state),
          categories (name)
        `)
        .eq("id", professionalId)
        .single();

      if (error) throw error;

      setProfessional(data);
      setFormData({
        phone: data.phone || "",
        email: data.email || "",
        website: data.website || "",
        description: data.description || "",
      });
    } catch (error) {
      console.error("Error fetching professional:", error);
      toast({
        title: "Error",
        description: "Failed to load your listing",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from("professionals")
        .update({
          phone: formData.phone,
          email: formData.email,
          website: formData.website,
          description: formData.description,
        })
        .eq("id", professionalId);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Your listing has been updated",
      });

      // Refresh data
      await fetchProfessional();
    } catch (error) {
      console.error("Error updating professional:", error);
      toast({
        title: "Error",
        description: "Failed to update your listing",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!professional) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Listing Not Found</h1>
        <Button onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  const cityName = professional.cities?.name || "Unknown";
  const stateName = professional.cities?.state || "";

  return (
    <>
      <Helmet>
        <title>Verify Your Listing - {professional.name} | Top10Lists.us</title>
        <meta name="description" content={`Verify and update your listing as one of ${cityName}'s top real estate agents`} />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="h-16 w-16 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Congratulations, {professional.name.split(' ')[0]}!</h1>
          <p className="text-xl text-muted-foreground">
            You've been selected as a finalist for one of {cityName}'s Top 10 Real Estate Agents
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Your Current Listing</CardTitle>
            <CardDescription>
              Review your information and update any details below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-6 mb-6">
              {professional.image_url && (
                <img
                  src={professional.image_url}
                  alt={professional.name}
                  className="w-32 h-32 object-cover rounded-lg"
                />
              )}
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">{professional.name}</h2>
                {professional.company && (
                  <p className="text-muted-foreground mb-2">{professional.company}</p>
                )}
                {professional.years_experience && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Award className="h-4 w-4" />
                    <span>{professional.years_experience} years of experience</span>
                  </div>
                )}
                {professional.specialty && professional.specialty.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {professional.specialty.map((spec, idx) => (
                      <span key={idx} className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-xs">
                        {spec}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="website"
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Professional Bio</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={6}
                  placeholder="Tell potential clients about your experience and expertise..."
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update My Listing"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What Happens Next?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>✓ Your listing will be reviewed by our team</p>
            <p>✓ You'll be featured as one of the Top 10 Real Estate Agents in {cityName}</p>
            <p>✓ Get exposure to thousands of potential clients searching for top agents</p>
            <p>✓ We'll contact you about premium placement opportunities</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
