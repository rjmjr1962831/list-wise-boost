import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, User } from "lucide-react";
import { ProfessionalCard } from "@/components/ProfessionalCard";

const JULIE_CALZA_RESEARCH = `## Julie Calza — Arizona Real Estate Agent:

### Overview
Julie Calza is a licensed Broker and practicing Realtor. She founded CalzaCo in 2016 after struggling to find trustworthy Real Estate solutions in the marketplace for military members, veterans, and their families. As a former Marine and Air Force Crew Chief wife, she intimately understands the needs of military personnel.

### Company & Contact
- **Team:** CalzaCo
- **Brokerage:** My Home Group
- **Location:** 6751 N Sunset Blvd, Ste 320, Glendale, AZ 85305
- **Website:** calzaco.com, juliecalza.com

### Specialization
CalzaCo is the #1 VA Real Estate Agent in AZ and specializes in helping military home buyers PCSing into or out of Luke Air Force Base make the most out of their VA Loan Benefit.

### Rankings & Awards
Julie Calza and the CalzaCo Team have ranked #1 in VA Home Loan Transactions by MLS data in the State of Arizona since 2017. CalzaCo has won 3 separate awards every year since 2019 for production expertise, and client satisfaction. In 2021 CalzaCo placed in the #1 position for production unit expertise out of over 3000 agents considered (an industry distinction).

The CalzaCo Team has won the YPN 40 Top Teams award the maximum 3 times. They have also been awarded the Best in Real Estate in the Valley Award (BREA), Top Transaction Coordinator in the Valley Award, Top Agent Magazine Cover among others. With Julie at the helm, CalzaCo has been honored with over two dozen industry level awards for client satisfaction, process expertise, and production experience.

### Published Author
Julie Calza became an Amazon #1 Best Seller for her book, "In the Arena: Battle-Tested Strategies to Secure Your Future". All profits from the first year's sales are being donated to Fighter Country Foundation to be used to enhance the lives of military members and families at Luke Air Force Base.

As the founder and CEO of CalzaCo, a top-ranked real estate team brokering through My Home Group, Julie intimately understands the needs of military families, which simply weren't being met in the real estate industry.

### Military Background & Service
As a former Marine and Air Force Spouse, Julie intimately understood how difficult it can be for military members and veterans to learn how to leverage their VA benefits to build stability for themselves outside of the military life. She built CalzaCo on providing honorable Real Estate solutions for military families and they remain the Top Ranked Real Estate solution for military buyers and sellers.

### Community Involvement
CalzaCo has also consistently donated funds, resources, and hundreds of hours in volunteer time to Morale and Wellness initiatives for the Airmen of Luke AFB and local Veterans making them a staple in the military community.

Julie Calza serves as the Blue Blazer Squadron vice chair at Fighter Country Foundation.

### Reviews & Reputation
CalzaCo By Julie Calza has a 5 star rating with 438 reviews.

Julie has closed over 1000 transactions and continues to adjust and improve on the CalzaCo process as the market and industry change.

### Notable Recognition
- **Amazon #1 Best Seller** — "In The Arena" book
- **#1 VA Real Estate Agent in Arizona** — Since 2017 (by MLS data)
- **#1 Production Unit Expertise** — Out of 3,000+ agents (2021)
- **Best in Real Estate Award (BREA)** — Valley award
- **YPN 40 Top Teams Award** — Won maximum 3 times
- **Top Agent Magazine Cover**
- **Blue Blazer Squadron Vice Chair** — Fighter Country Foundation`;

export default function ManualProfileEnricher() {
  const [enriching, setEnriching] = useState(false);
  const [enrichedProfiles, setEnrichedProfiles] = useState<any[]>([]);

  const enrichProfiles = async () => {
    setEnriching(true);
    setEnrichedProfiles([]);
    
    try {
      // Find Julie Calza
      const { data: julieData } = await supabase
        .from('professionals')
        .select('*')
        .ilike('name', '%Julie Calza%')
        .single();

      if (!julieData) {
        toast.error('Julie Calza not found');
        return;
      }

      console.log('Found Julie Calza:', julieData.id);

      // Synthesize Julie's profile
      toast.info('Synthesizing Julie Calza profile...');
      const { data: julieResult, error: julieError } = await supabase.functions.invoke('synthesize-agent-profile', {
        body: {
          professionalId: julieData.id,
          rawResearch: JULIE_CALZA_RESEARCH
        }
      });

      if (julieError) {
        console.error('Julie synthesis error:', julieError);
        toast.error('Failed to synthesize Julie Calza profile');
      } else {
        console.log('Julie synthesis result:', julieResult);
        toast.success('Julie Calza profile synthesized!');
      }

      // Fetch updated Julie profile
      const { data: updatedJulie } = await supabase
        .from('professionals')
        .select('*')
        .eq('id', julieData.id)
        .single();

      if (updatedJulie) {
        setEnrichedProfiles(prev => [...prev, updatedJulie]);
      }

      // Try to find Rachel/Raquel Quinet
      const { data: rachelData } = await supabase
        .from('professionals')
        .select('*')
        .or('name.ilike.%Rachel%Quinet%,name.ilike.%Raquel%Quinet%')
        .maybeSingle();

      if (rachelData) {
        console.log('Found Raquel Quinet:', rachelData.id);
        
        // For Raquel, we'll just fetch her current profile since we don't have detailed research
        toast.info('Loading Raquel Quinet profile...');
        setEnrichedProfiles(prev => [...prev, rachelData]);
      } else {
        toast.info('Raquel/Rachel Quinet not found in database');
      }

      toast.success('Profile enrichment complete!');
    } catch (error) {
      console.error('Enrichment error:', error);
      toast.error('Failed to enrich profiles');
    } finally {
      setEnriching(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Manual Profile Enrichment
          </CardTitle>
          <CardDescription>
            Enrich Julie Calza and Raquel Quinet profiles with synthesis pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={enrichProfiles}
            disabled={enriching}
            className="w-full"
          >
            {enriching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enriching Profiles...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Enrich Julie Calza & Raquel Quinet
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {enrichedProfiles.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <User className="h-6 w-6" />
            Enriched Profiles
          </h2>
          
          {enrichedProfiles.map((profile) => {
            // Convert database record to Professional type format
            const professional = {
              rank: profile.rank,
              name: profile.name,
              id: profile.id,
              title: profile.title,
              company: profile.company,
              rating: profile.review_stars_rating || 0,
              reviews: profile.num_total_reviews || 0,
              specialties: profile.specialty || [],
              address: profile.address || '',
              phone: profile.phone || '',
              email: profile.email || '',
              website: profile.website || '',
              description: profile.description || '',
              stats: {
                totalSales: profile.total_sales,
                yearsExperience: profile.years_experience
              },
              verified: !!profile.license_verified_at,
              image: profile.image_url || '/placeholder.svg',
              license_number: profile.license_number,
              license_verified_at: profile.license_verified_at,
              zuid: profile.zuid,
              total_sales: profile.total_sales,
              years_experience: profile.years_experience,
              zillow_profile_url: profile.zillow_profile_url,
              get_to_know_me: profile.get_to_know_me,
              press_mentions: profile.press_mentions,
              notable_achievements: profile.notable_achievements,
              publications: profile.publications,
              community_roles: profile.community_roles,
              synthesized_bio: profile.synthesized_bio,
              profile_last_synthesized_at: profile.profile_last_synthesized_at
            };

            return (
              <div key={profile.id}>
                <ProfessionalCard
                  professional={professional}
                  accentColor="primary"
                  schemaType="RealEstateAgent"
                  market={`${profile.city_id}, AZ`}
                  stateAbbr="AZ"
                  quizCompleted={true}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}