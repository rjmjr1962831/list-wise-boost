import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2 } from 'lucide-react';

export default function AdminTestProspects() {
  const [isAdding, setIsAdding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const { toast } = useToast();

  const handleAddTestProspects = async () => {
    setIsAdding(true);
    try {
      const testProspects = [
        {
          name: 'John Smith',
          email: 'john.smith@example.com',
          phone: '602-555-0101',
          company: 'ABC Realty',
          city: 'Phoenix',
          state: 'AZ',
        },
        {
          name: 'Sarah Johnson',
          email: 'sarah.j@example.com',
          phone: '480-555-0102',
          company: 'Desert Properties',
          city: 'Scottsdale',
          state: 'AZ',
        },
        {
          name: 'Mike Williams',
          email: 'mike.w@example.com',
          phone: '623-555-0103',
          company: 'Valley Homes',
          city: 'Glendale',
          state: 'AZ',
        },
        {
          name: 'Emily Davis',
          email: 'emily.d@example.com',
          phone: '602-555-0104',
          company: 'Metro Realty',
          city: 'Tempe',
          state: 'AZ',
        },
        {
          name: 'Robert Brown',
          email: 'robert.b@example.com',
          phone: '480-555-0105',
          company: 'Arizona Estates',
          city: 'Mesa',
          state: 'AZ',
        },
      ];

      const { error } = await supabase.from('prospects').insert(testProspects);

      if (error) throw error;

      toast({
        title: 'Test Prospects Added',
        description: `${testProspects.length} test prospects added successfully`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsAdding(false);
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
        <h2 className="text-2xl font-bold mb-2">Test Prospects</h2>
        <p className="text-muted-foreground">
          Add or clear test prospects for Pipedrive sync testing
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Add Test Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Add 5 sample prospects with basic information (no Zillow data)
          </p>
          <div className="flex gap-2">
            <Button onClick={handleAddTestProspects} disabled={isAdding}>
              <Plus className="w-4 h-4 mr-2" />
              {isAdding ? 'Adding...' : 'Add 5 Test Prospects'}
            </Button>
            <Button 
              onClick={handleClearProspects} 
              disabled={isClearing}
              variant="destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {isClearing ? 'Clearing...' : 'Clear All Prospects'}
            </Button>
          </div>
          <div className="text-sm text-muted-foreground space-y-1 border-l-2 border-border pl-3">
            <p><strong>Test prospects include:</strong></p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>John Smith - ABC Realty, Phoenix</li>
              <li>Sarah Johnson - Desert Properties, Scottsdale</li>
              <li>Mike Williams - Valley Homes, Glendale</li>
              <li>Emily Davis - Metro Realty, Tempe</li>
              <li>Robert Brown - Arizona Estates, Mesa</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
