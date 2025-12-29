import { Card } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

/**
 * @deprecated This component uses Apify actors (fetch-agenscrape-agents)
 * which have been deprecated in favor of the Exa→Firecrawl pipeline.
 * 
 * Use the Firecrawl-based import tools instead.
 */
export function ZillowAgentImporter() {
  return (
    <Card className="p-6 border-destructive/50 bg-destructive/5">
      <div className="flex items-start gap-4">
        <AlertTriangle className="h-8 w-8 text-destructive flex-shrink-0" />
        <div>
          <h2 className="text-xl font-bold text-destructive mb-2">
            ⚠️ DEPRECATED - Zillow Agent Importer
          </h2>
          <p className="text-muted-foreground mb-4">
            This component has been disabled because it uses deprecated Apify actors:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mb-4">
            <li><code>fetch-agenscrape-agents</code> → uses getdataforme Apify actor</li>
          </ul>
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
            <h3 className="font-semibold text-primary mb-2">✅ Use Instead:</h3>
            <p className="text-sm">
              The current pipeline uses <strong>Exa → Firecrawl</strong>:
            </p>
            <ol className="list-decimal list-inside text-sm mt-2 space-y-1">
              <li>Exa for prequalification (find Zillow URL, check rating/reviews)</li>
              <li>Firecrawl for full enrichment (only on qualified agents)</li>
            </ol>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default ZillowAgentImporter;
