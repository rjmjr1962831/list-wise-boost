import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Phone, Mail, Globe, Award, Copy, ExternalLink } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { toast as sonnerToast } from "sonner";

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
  const [ogImageUrl, setOgImageUrl] = useState<string>("");

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
      
      // Load OG image
      const cacheBust = Date.now();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-og-image?id=${data.id}&v=${cacheBust}`;
      setOgImageUrl(url);
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
  
  const agentUrl = professional.cities 
    ? `${window.location.origin}/top10realestateagents/${professional.cities.name.toLowerCase().replace(/\s+/g, '-')}-${professional.cities.state.toLowerCase()}`
    : "";

  const copyMetaTags = () => {
    const metaTags = `
<meta property="og:title" content="${professional?.name} - Top Real Estate Agent" />
<meta property="og:description" content="${professional?.description?.substring(0, 200) || 'Premier real estate services'}" />
<meta property="og:image" content="${ogImageUrl}" />
<meta property="og:url" content="${agentUrl}" />
<meta property="og:type" content="profile" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${professional?.name} - Top Real Estate Agent" />
<meta name="twitter:description" content="${professional?.description?.substring(0, 200) || 'Premier real estate services'}" />
<meta name="twitter:image" content="${ogImageUrl}" />
    `.trim();

    navigator.clipboard.writeText(metaTags);
    sonnerToast.success("Meta tags copied to clipboard!");
  };

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
          <h1 className="text-3xl font-bold mb-2">Congratulations, {(() => {
            // Parse name to handle couples like "Don and Jenny Matheson" or "Mark & Dina Beauvais"
            const andMatch = professional.name.match(/^(\w+)\s+(?:and|&)\s+(\w+)\s+/i);
            if (andMatch) {
              return `${andMatch[1]} and ${andMatch[2]}`;
            }
            return professional.name.split(' ')[0];
          })()}!</h1>
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

        {/* Social Media Preview Section */}
        {ogImageUrl && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Social Media Preview</CardTitle>
              <CardDescription>
                See how your profile will appear when shared on social media
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="facebook">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="facebook">Facebook</TabsTrigger>
                  <TabsTrigger value="twitter">Twitter/X</TabsTrigger>
                  <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
                </TabsList>

                {/* Facebook Preview */}
                <TabsContent value="facebook">
                  <div className="border rounded-lg overflow-hidden bg-white">
                    <img 
                      src={ogImageUrl} 
                      alt="Facebook Preview" 
                      className="w-full h-auto"
                    />
                    <div className="p-3 border-t bg-gray-50">
                      <p className="text-xs text-gray-500 uppercase mb-1">top10lists.us</p>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {professional.name} - Top Real Estate Agent
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {professional.description || 'Premier real estate services'}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                {/* Twitter Preview */}
                <TabsContent value="twitter">
                  <div className="border rounded-xl overflow-hidden bg-white max-w-[504px]">
                    <img 
                      src={ogImageUrl} 
                      alt="Twitter Preview" 
                      className="w-full h-auto"
                    />
                    <div className="p-3 border-t">
                      <p className="text-xs text-gray-500 mb-1">top10lists.us</p>
                      <h3 className="font-semibold text-gray-900 text-sm mb-1">
                        {professional.name} - Top Real Estate Agent
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-1">
                        {professional.description || 'Premier real estate services'}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                {/* LinkedIn Preview */}
                <TabsContent value="linkedin">
                  <div className="border rounded-lg overflow-hidden bg-white">
                    <img 
                      src={ogImageUrl} 
                      alt="LinkedIn Preview" 
                      className="w-full h-auto"
                    />
                    <div className="p-4 border-t bg-gray-50">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {professional.name} - Top Real Estate Agent
                      </h3>
                      <p className="text-xs text-gray-500 mb-2">top10lists.us</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-4 pt-4 border-t space-y-3">
                <Button
                  variant="outline"
                  onClick={copyMetaTags}
                  className="w-full"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Meta Tags
                </Button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    asChild
                    size="sm"
                  >
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(agentUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Test on Facebook
                    </a>
                  </Button>

                  <Button
                    variant="outline"
                    asChild
                    size="sm"
                  >
                    <a
                      href={`https://cards-dev.twitter.com/validator`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Twitter Validator
                    </a>
                  </Button>

                  <Button
                    variant="outline"
                    asChild
                    size="sm"
                  >
                    <a
                      href={`https://www.linkedin.com/post-inspector/inspect/${encodeURIComponent(agentUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      LinkedIn Inspector
                    </a>
                  </Button>

                  <Button
                    variant="outline"
                    asChild
                    size="sm"
                  >
                    <a
                      href={`https://opengraphcheck.com/result.php?url=${encodeURIComponent(agentUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      OG Check
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
