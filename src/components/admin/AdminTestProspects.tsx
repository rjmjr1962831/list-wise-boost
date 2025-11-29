import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Users, Database, Trash2, AlertCircle } from 'lucide-react';

export default function AdminTestProspects() {
  const [isCopying, setIsCopying] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [proCount, setProCount] = useState(0);
  const [prospectCount, setProspectCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchCounts();
  }, []);

  const fetchCounts = async () => {
    const { count: pros } = await supabase
      .from('professionals')
      .select('*', { count: 'exact', head: true })
      .not('email', 'is', null);
    
    const { count: prospects } = await supabase
      .from('prospects')
      .select('*', { count: 'exact', head: true });

    setProCount(pros || 0);
    setProspectCount(prospects || 0);
  };

  const handleCopyFromProfessionals = async () => {
    if (!confirm(`Copy up to 5 agents from professionals to prospects?`)) {
      return;
    }

    setIsCopying(true);
    try {
      // Get first 5 professionals with email
      const { data: professionals, error: fetchError } = await supabase
        .from('professionals')
        .select('*')
        .not('email', 'is', null)
        .limit(5);

      if (fetchError) throw fetchError;
      if (!professionals || professionals.length === 0) {
        toast({
          title: 'No Data',
          description: 'No professionals found with email addresses',
          variant: 'destructive',
        });
        return;
      }

      // Map to prospects format
      const prospects = professionals.map(pro => ({
        name: pro.name,
        email: pro.email,
        phone: pro.phone,
        company: pro.company,
        city: null,
        state: null,
        zillow_profile_url: pro.zillow_profile_url,
        zillow_rating: pro.review_stars_rating,
        zillow_reviews: pro.num_total_reviews,
      }));

      const { error: insertError } = await supabase.from('prospects').insert(prospects);

      if (insertError) throw insertError;

      toast({
        title: 'Agents Copied',
        description: `${prospects.length} agents copied to prospects`,
      });
      
      fetchCounts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCopying(false);
    }
  };

  const handleClearProspects = async () => {
    if (!confirm('Are you sure you want to delete ALL prospects? This cannot be undone.')) {
      return;
    }

    setIsClearing(true);
    try {
      const { error } = await supabase.from('prospects').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;

      toast({
        title: 'Prospects Cleared',
        description: 'All prospects have been deleted',
      });
      
      fetchCounts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Populate Prospects</h2>
        <p className="text-muted-foreground">
          Prospects are real estate agents to be synced with Pipedrive
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">Professionals</span>
            </div>
            <p className="text-3xl font-bold">{proCount}</p>
            <p className="text-sm text-muted-foreground mt-1">agents in database</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">Prospects</span>
            </div>
            <p className="text-3xl font-bold">{prospectCount}</p>
            <p className="text-sm text-muted-foreground mt-1">ready for sync</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Copy Agents from Professionals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Copy up to 5 agents from your professionals table to test Pipedrive sync
          </p>
          <Button onClick={handleCopyFromProfessionals} disabled={isCopying}>
            <Users className="w-4 h-4 mr-2" />
            {isCopying ? 'Copying...' : 'Copy 5 Agents to Prospects'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-medium">For Production Use</p>
              <p className="text-sm text-muted-foreground">
                Use the <strong>Zillow Scraper</strong> tab to scrape agents with full Zillow ranking data (position, page, ratings, etc.) or the <strong>Prospects</strong> tab to view and manage all prospects.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Clear all prospects from the database. This cannot be undone.
          </p>
          <Button 
            onClick={handleClearProspects} 
            disabled={isClearing}
            variant="destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {isClearing ? 'Clearing...' : 'Clear All Prospects'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
