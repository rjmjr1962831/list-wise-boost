import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

interface ProfileSynthesizerProps {
  professionalId: string;
  professionalName: string;
  onSuccess?: () => void;
}

export function ProfileSynthesizer({ professionalId, professionalName, onSuccess }: ProfileSynthesizerProps) {
  const [rawResearch, setRawResearch] = useState("");
  const [synthesizing, setSynthesizing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSynthesize = async () => {
    if (!rawResearch.trim()) {
      toast.error("Please paste research data first");
      return;
    }

    setSynthesizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('synthesize-agent-profile', {
        body: {
          professionalId,
          rawResearch
        }
      });

      if (error) throw error;

      if (data?.success) {
        setResult(data.data);
        toast.success("Profile synthesized successfully!");
        if (onSuccess) onSuccess();
      } else {
        throw new Error("Synthesis failed");
      }
    } catch (error) {
      console.error('Synthesis error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to synthesize profile");
    } finally {
      setSynthesizing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Profile Synthesizer
        </CardTitle>
        <CardDescription>
          AI-powered extraction of achievements, publications, and bio from raw research
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="research">Raw Research Data (from Claude or other sources)</Label>
          <Textarea
            id="research"
            placeholder={`Paste detailed research about ${professionalName}...

Example:
## Julie Calza — Arizona Real Estate Agent:

### Overview
Julie Calza is a former Marine and Air Force Crew Chief wife...

### Rankings & Awards
- #1 VA Real Estate Agent in Arizona since 2017
- Amazon #1 Best Seller for "In the Arena"
...`}
            value={rawResearch}
            onChange={(e) => setRawResearch(e.target.value)}
            rows={12}
            className="font-mono text-sm"
          />
        </div>

        <Button 
          onClick={handleSynthesize} 
          disabled={synthesizing || !rawResearch.trim()}
          className="w-full"
        >
          {synthesizing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Synthesizing...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Synthesize Profile
            </>
          )}
        </Button>

        {result && (
          <div className="mt-6 space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Synthesis Results</h3>
              {result.websiteUsed && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  ✓ Website content used
                </span>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Synthesized Bio (3-5 sentences)</Label>
              <div 
                className="text-sm bg-muted p-3 rounded-md whitespace-pre-line"
                dangerouslySetInnerHTML={{ __html: result.synthesized_bio }}
              />
            </div>

            {result.areas_served?.length > 0 && (
              <div className="space-y-2">
                <Label>Areas Served ({result.areas_served.length})</Label>
                <div className="flex flex-wrap gap-2">
                  {result.areas_served.map((area: string, idx: number) => (
                    <span key={idx} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.specialties_extracted?.length > 0 && (
              <div className="space-y-2">
                <Label>Specialties Extracted ({result.specialties_extracted.length})</Label>
                <div className="flex flex-wrap gap-2">
                  {result.specialties_extracted.map((spec: string, idx: number) => (
                    <span key={idx} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.notable_achievements?.length > 0 && (
              <div className="space-y-2">
                <Label>Notable Achievements ({result.notable_achievements.length})</Label>
                <div className="space-y-2">
                  {result.notable_achievements.map((achievement: any, idx: number) => (
                    <div key={idx} className="bg-muted p-3 rounded-md">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-semibold">{achievement.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{achievement.description}</p>
                          {achievement.date && (
                            <p className="text-xs text-muted-foreground mt-1">Date: {achievement.date}</p>
                          )}
                          {achievement.source && (
                            <p className="text-xs text-muted-foreground">Source: {achievement.source}</p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                            Credibility: {achievement.credibility}/10
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.publications?.length > 0 && (
              <div className="space-y-2">
                <Label>Publications ({result.publications.length})</Label>
                <div className="space-y-2">
                  {result.publications.map((pub: any, idx: number) => (
                    <div key={idx} className="bg-muted p-3 rounded-md">
                      <p className="font-semibold">{pub.title}</p>
                      <p className="text-sm text-muted-foreground">{pub.type} {pub.publisher && `— ${pub.publisher}`}</p>
                      {pub.year && <p className="text-xs text-muted-foreground">Published: {pub.year}</p>}
                      {pub.url && (
                        <a href={pub.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                          View Publication →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.community_roles?.length > 0 && (
              <div className="space-y-2">
                <Label>Community & Leadership Roles ({result.community_roles.length})</Label>
                <div className="space-y-2">
                  {result.community_roles.map((role: any, idx: number) => (
                    <div key={idx} className="bg-muted p-3 rounded-md">
                      <p className="font-semibold">{role.organization}</p>
                      <p className="text-sm">{role.role}</p>
                      {role.description && (
                        <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}