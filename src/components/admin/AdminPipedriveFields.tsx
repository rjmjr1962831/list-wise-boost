import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Save } from 'lucide-react';

const FIELD_NAMES = [
  { name: 'supabase_id', label: 'Supabase ID' },
  { name: 'zillow_position', label: 'Zillow Position' },
  { name: 'zillow_page', label: 'Zillow Page' },
  { name: 'agents_ahead', label: 'Agents Ahead' },
  { name: 'zillow_total_agents', label: 'Zillow Total Agents' },
  { name: 'zillow_rating', label: 'Zillow Rating' },
  { name: 'zillow_reviews', label: 'Zillow Reviews' },
  { name: 'zillow_profile_url', label: 'Zillow Profile URL' },
  { name: 'prospect_status', label: 'Prospect Status' },
];

export default function AdminPipedriveFields() {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchFields();
  }, []);

  const fetchFields = async () => {
    const { data, error } = await supabase
      .from('pipedrive_field_mapping')
      .select('field_name, pipedrive_key');

    if (data) {
      const mapping: Record<string, string> = {};
      data.forEach((row) => {
        mapping[row.field_name] = row.pipedrive_key;
      });
      setFields(mapping);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const [fieldName, pipedriveKey] of Object.entries(fields)) {
        if (pipedriveKey) {
          await supabase.from('pipedrive_field_mapping').upsert(
            { field_name: fieldName, pipedrive_key: pipedriveKey },
            { onConflict: 'field_name' }
          );
        }
      }

      toast({ title: 'Field mappings saved!' });
    } catch (error: any) {
      toast({
        title: 'Save Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Pipedrive Field Mapping</h2>
        <p className="text-muted-foreground">
          Configure the Pipedrive custom field API keys for data synchronization
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Custom Field Keys</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter the Pipedrive API keys for each custom field. Find these in Pipedrive:
            Settings → Data fields → Person → Click field → Copy API key.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {FIELD_NAMES.map(({ name, label }) => (
              <div key={name} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <label className="font-medium">{label}</label>
                <Input
                  placeholder="e.g., abc123def456..."
                  value={fields[name] || ''}
                  onChange={(e) =>
                    setFields({ ...fields, [name]: e.target.value })
                  }
                />
              </div>
            ))}
          </div>

          <Button className="mt-6" onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Mappings'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">1. Create Custom Fields in Pipedrive</h4>
            <p className="text-sm text-muted-foreground">
              Go to Settings → Data fields → Person and create these custom fields:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground mt-2">
              <li>Supabase ID (Text)</li>
              <li>Zillow Position (Number)</li>
              <li>Zillow Page (Number)</li>
              <li>Agents Ahead (Number)</li>
              <li>Zillow Total Agents (Number)</li>
              <li>Zillow Rating (Number)</li>
              <li>Zillow Reviews (Number)</li>
              <li>Zillow Profile URL (Text)</li>
              <li>Prospect Status (Single option: new, contacted, interested, customer, declined)</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">2. Get API Keys</h4>
            <p className="text-sm text-muted-foreground">
              After creating each field, click on it to view its API key (hash code) and enter it above.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">3. Configure Secrets</h4>
            <p className="text-sm text-muted-foreground">
              Ensure PIPEDRIVE_API_TOKEN and PIPEDRIVE_DOMAIN are set in your secrets.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
