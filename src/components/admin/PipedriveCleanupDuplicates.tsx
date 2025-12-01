import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Trash2, AlertTriangle, CheckCircle, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function PipedriveCleanupDuplicates() {
  const [isScanning, setIsScanning] = useState(false);
  const [isDryRun, setIsDryRun] = useState(true);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const handleCleanup = async (dryRun: boolean) => {
    setIsScanning(true);
    setIsDryRun(dryRun);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('pipedrive-cleanup-duplicates', {
        body: { dry_run: dryRun }
      });

      if (error) throw error;

      setResults(data.stats);

      toast({
        title: dryRun ? 'Dry Run Complete' : 'Cleanup Complete',
        description: data.message,
        variant: 'default',
      });
    } catch (error: any) {
      toast({
        title: 'Cleanup Failed',
        description: error.message,
        variant: 'destructive',
      });
      console.error('Cleanup error:', error);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pipedrive Duplicate Contact Cleanup</CardTitle>
          <CardDescription>
            Scan all Pipedrive contacts for duplicates (same email) and merge them automatically.
            <br />
            The system will keep the contact with the most data (deals, activities, notes) and merge others into it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Button 
              onClick={() => handleCleanup(true)} 
              disabled={isScanning}
              size="lg"
              variant="outline"
            >
              <Eye className={`w-4 h-4 mr-2 ${isScanning && isDryRun ? 'animate-spin' : ''}`} />
              {isScanning && isDryRun ? 'Scanning...' : 'Dry Run (Preview Only)'}
            </Button>

            <Button 
              onClick={() => handleCleanup(false)} 
              disabled={isScanning}
              size="lg"
              variant="destructive"
            >
              <Trash2 className={`w-4 h-4 mr-2 ${isScanning && !isDryRun ? 'animate-spin' : ''}`} />
              {isScanning && !isDryRun ? 'Cleaning Up...' : 'Clean Up (Live Mode)'}
            </Button>
          </div>

          {results && (
            <div className="space-y-4 pt-4 border-t">
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{results.totalContacts}</div>
                  <div className="text-sm text-muted-foreground">Total Contacts</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{results.duplicateEmails}</div>
                  <div className="text-sm text-muted-foreground">Duplicate Emails</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1">
                    <CheckCircle className="w-5 h-5" />
                    {results.merged}
                  </div>
                  <div className="text-sm text-muted-foreground">Merged</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-5 h-5" />
                    {results.failed}
                  </div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </div>

              {results.duplicateEmails > 0 && (
                <>
                  <Badge variant={isDryRun ? "outline" : "default"} className="w-full justify-center py-2">
                    {isDryRun ? '🔍 DRY RUN - No changes made' : '✅ LIVE MODE - Changes applied'}
                  </Badge>

                  <Tabs defaultValue="summary" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="summary">Summary</TabsTrigger>
                      <TabsTrigger value="details">Merge Details</TabsTrigger>
                    </TabsList>

                    <TabsContent value="summary" className="space-y-2">
                      <div className="p-4 bg-muted rounded-lg">
                        <h4 className="font-semibold mb-2">Cleanup Summary</h4>
                        <ul className="space-y-1 text-sm">
                          <li>• Found {results.duplicateEmails} emails with duplicates</li>
                          <li>• {results.duplicateContacts} duplicate contacts total</li>
                          <li>• {results.merged} contacts {isDryRun ? 'would be merged' : 'merged successfully'}</li>
                          {results.failed > 0 && <li>• {results.failed} merges failed</li>}
                        </ul>
                      </div>
                    </TabsContent>

                    <TabsContent value="details">
                      <ScrollArea className="h-96 w-full border rounded-md p-4">
                        <div className="space-y-4">
                          {results.mergeDetails?.map((detail: any, idx: number) => (
                            <div key={idx} className="p-3 bg-muted rounded-lg">
                              <div className="font-semibold text-sm mb-2">📧 {detail.email}</div>
                              <div className="text-xs space-y-1">
                                <div>
                                  <span className="font-medium">Primary:</span> ID {detail.primary.id} - {detail.primary.name}
                                </div>
                                <div>
                                  <span className="font-medium">Merged into primary:</span>
                                  <div className="ml-4 mt-1">
                                    {detail.merged.map((id: number) => (
                                      <Badge key={id} variant="secondary" className="mr-1 mb-1">
                                        ID {id}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                                {detail.failed.length > 0 && (
                                  <div>
                                    <span className="font-medium text-destructive">Failed:</span>
                                    <div className="ml-4 mt-1">
                                      {detail.failed.map((id: number) => (
                                        <Badge key={id} variant="destructive" className="mr-1 mb-1">
                                          ID {id}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </>
              )}

              {results.errors?.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-destructive font-semibold">
                    <AlertTriangle className="w-4 h-4" />
                    Merge Errors ({results.errors.length})
                  </div>
                  <ScrollArea className="h-48 w-full border rounded-md p-4">
                    <div className="space-y-3">
                      {results.errors.map((err: any, idx: number) => (
                        <div key={idx} className="p-3 bg-destructive/10 rounded-lg text-sm">
                          <div className="font-semibold">{err.email}</div>
                          <div className="text-xs text-muted-foreground">
                            Primary ID: {err.primaryId}, Duplicate ID: {err.duplicateId}
                          </div>
                          <div className="text-destructive mt-1">{err.error}</div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
