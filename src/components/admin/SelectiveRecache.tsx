import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Zap } from "lucide-react";

interface PageCategory {
  id: string;
  label: string;
  description: string;
  getUrls: () => Promise<string[]>;
}

const BASE_URL = "https://www.top10lists.us";

export function SelectiveRecache() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });

  const categories: PageCategory[] = [
    {
      id: "homepage",
      label: "Homepage",
      description: "Just the main landing page",
      getUrls: async () => [`${BASE_URL}/`]
    },
    {
      id: "faq",
      label: "FAQ Page",
      description: "The dedicated FAQ page",
      getUrls: async () => [`${BASE_URL}/faq`]
    },
    {
      id: "static",
      label: "Static Pages",
      description: "About, Privacy, Terms, Agent Info, etc.",
      getUrls: async () => [
        `${BASE_URL}/about`,
        `${BASE_URL}/privacy`,
        `${BASE_URL}/terms`,
        `${BASE_URL}/sms-terms`,
        `${BASE_URL}/agent-info`,
        `${BASE_URL}/ranking-methodology`,
        `${BASE_URL}/join`,
        `${BASE_URL}/agent-onboarding`
      ]
    },
    {
      id: "city-pages",
      label: "All City Pages",
      description: "All Arizona city listing pages (~48 pages)",
      getUrls: async () => {
        const { data: cities } = await supabase
          .from('cities')
          .select('slug, state_slug')
          .eq('active', true);
        
        if (!cities) return [];
        return cities.map(c => `${BASE_URL}/${c.state_slug}/${c.slug}/top10realestateagents`);
      }
    },
    {
      id: "city-qa",
      label: "City Q&A Pages",
      description: "Q&A pages for all cities",
      getUrls: async () => {
        const { data: cities } = await supabase
          .from('cities')
          .select('slug, state_slug')
          .eq('active', true);
        
        if (!cities) return [];
        return cities.map(c => `${BASE_URL}/${c.state_slug}/${c.slug}/top10realestateagents/questions`);
      }
    }
  ];

  const toggleCategory = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const handleRecache = async () => {
    if (selected.size === 0) {
      toast.error("Select at least one category to recache");
      return;
    }

    setIsProcessing(true);
    setProgress({ current: 0, total: 0, success: 0, failed: 0 });

    try {
      // Gather all URLs from selected categories
      const allUrls: string[] = [];
      for (const catId of selected) {
        const category = categories.find(c => c.id === catId);
        if (category) {
          const urls = await category.getUrls();
          allUrls.push(...urls);
        }
      }

      // Remove duplicates
      const uniqueUrls = [...new Set(allUrls)];
      setProgress(p => ({ ...p, total: uniqueUrls.length }));

      toast.info(`Recaching ${uniqueUrls.length} pages...`);

      // Process URLs one by one with small delay
      let success = 0;
      let failed = 0;

      for (let i = 0; i < uniqueUrls.length; i++) {
        const url = uniqueUrls[i];
        
        try {
          const { error } = await supabase.functions.invoke('warm-cache-single', {
            body: { url }
          });

          if (error) {
            console.error(`Failed to warm ${url}:`, error);
            failed++;
          } else {
            success++;
          }
        } catch (err) {
          console.error(`Error warming ${url}:`, err);
          failed++;
        }

        setProgress({ current: i + 1, total: uniqueUrls.length, success, failed });

        // Small delay to avoid overwhelming the system
        if (i < uniqueUrls.length - 1) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      toast.success(`Recache complete: ${success} succeeded, ${failed} failed`);
    } catch (error) {
      console.error("Recache error:", error);
      toast.error("Failed to recache pages");
    } finally {
      setIsProcessing(false);
    }
  };

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Selective Cache Warm
        </CardTitle>
        <CardDescription>
          Only recache pages that changed after a deploy. Much faster than full site recache.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {categories.map((category) => (
            <div 
              key={category.id}
              className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                id={category.id}
                checked={selected.has(category.id)}
                onCheckedChange={() => toggleCategory(category.id)}
                disabled={isProcessing}
              />
              <div className="flex-1">
                <Label htmlFor={category.id} className="font-medium cursor-pointer">
                  {category.label}
                </Label>
                <p className="text-sm text-muted-foreground">{category.description}</p>
              </div>
            </div>
          ))}
        </div>

        {isProcessing && (
          <div className="space-y-2 p-4 bg-muted rounded-lg">
            <div className="flex justify-between text-sm">
              <span>Progress: {progress.current} / {progress.total}</span>
              <span>{progressPercent.toFixed(0)}%</span>
            </div>
            <Progress value={progressPercent} />
            <div className="flex gap-4 text-sm">
              <Badge variant="default" className="bg-green-600">
                Success: {progress.success}
              </Badge>
              {progress.failed > 0 && (
                <Badge variant="destructive">
                  Failed: {progress.failed}
                </Badge>
              )}
            </div>
          </div>
        )}

        <Button 
          onClick={handleRecache} 
          disabled={isProcessing || selected.size === 0}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Recaching...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Recache Selected ({selected.size} categories)
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground">
          Tip: After a code push, select only the categories that were affected by your changes.
          Header/Footer changes affect all pages.
        </p>
      </CardContent>
    </Card>
  );
}
