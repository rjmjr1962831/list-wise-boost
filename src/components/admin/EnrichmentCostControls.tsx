import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Info, DollarSign, Zap } from "lucide-react";
import { toast } from "sonner";

interface EnrichmentOptions {
  dryRun: boolean;
  skipRecentlyEnriched: boolean;
  skipGenericBios: boolean;
  skipIfNoPress: boolean;
}

export const EnrichmentCostControls = () => {
  const [options, setOptions] = useState<EnrichmentOptions>({
    dryRun: false,
    skipRecentlyEnriched: true,
    skipGenericBios: true,
    skipIfNoPress: true,
  });

  const handleToggle = (key: keyof EnrichmentOptions) => {
    setOptions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const estimateCredits = () => {
    const baseCreditsPerAgent = 10; // 5 for bio rewrite + 5 for synthesis
    let creditsPerAgent = baseCreditsPerAgent;

    if (options.skipGenericBios) creditsPerAgent -= 2.5; // Save ~25% on bio rewrites
    if (options.skipIfNoPress) creditsPerAgent -= 2.5; // Save ~25% on synthesis
    if (options.skipRecentlyEnriched) creditsPerAgent *= 0.3; // Only ~30% need re-enrichment

    return {
      withoutOptimization: baseCreditsPerAgent,
      withOptimization: creditsPerAgent.toFixed(1),
      savingsPercent: ((1 - creditsPerAgent / baseCreditsPerAgent) * 100).toFixed(0)
    };
  };

  const credits = estimateCredits();

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Cost Controls</h3>
      </div>

      <div className="space-y-4">
        {/* Dry Run Mode */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="dry-run" className="font-medium">Dry Run Mode</Label>
              <Info className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Log what would happen without making AI calls (zero cost)
            </p>
          </div>
          <Switch
            id="dry-run"
            checked={options.dryRun}
            onCheckedChange={() => handleToggle('dryRun')}
          />
        </div>

        {/* Skip Recently Enriched */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="skip-recent" className="font-medium">Skip Recently Enriched</Label>
              <Zap className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Skip agents enriched within 7 days (saves ~70% of calls)
            </p>
          </div>
          <Switch
            id="skip-recent"
            checked={options.skipRecentlyEnriched}
            onCheckedChange={() => handleToggle('skipRecentlyEnriched')}
          />
        </div>

        {/* Skip Generic Bios */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="skip-generic" className="font-medium">Skip Generic Bio Rewrites</Label>
              <Zap className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Don't rewrite bios that are too short or templated (saves ~25%)
            </p>
          </div>
          <Switch
            id="skip-generic"
            checked={options.skipGenericBios}
            onCheckedChange={() => handleToggle('skipGenericBios')}
          />
        </div>

        {/* Skip If No Press */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="skip-no-press" className="font-medium">Skip Synthesis Without Press</Label>
              <Zap className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Don't synthesize profiles when no press mentions found (saves ~25%)
            </p>
          </div>
          <Switch
            id="skip-no-press"
            checked={options.skipIfNoPress}
            onCheckedChange={() => handleToggle('skipIfNoPress')}
          />
        </div>

        {/* Credit Estimation */}
        <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="font-medium">Estimated Cost per Agent</span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Without optimization:</span>
              <span className="font-mono">{credits.withoutOptimization} credits</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">With current settings:</span>
              <span className="font-mono font-semibold text-primary">{credits.withOptimization} credits</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-primary/20">
              <span className="font-medium">Savings:</span>
              <span className="font-semibold text-green-600">{credits.savingsPercent}%</span>
            </div>
          </div>
        </div>

        {/* Export Button */}
        <Button
          onClick={() => {
            const json = JSON.stringify(options, null, 2);
            navigator.clipboard.writeText(json);
            toast.success("Cost control settings copied to clipboard");
          }}
          variant="outline"
          className="w-full"
        >
          Copy Settings
        </Button>

        <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded">
          <strong>Note:</strong> These settings will be passed to enrichment functions when called.
          Make sure to include them in your API requests.
        </div>
      </div>
    </Card>
  );
};
