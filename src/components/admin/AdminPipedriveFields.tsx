import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Save, AlertCircle, Check } from 'lucide-react';
import { AdminPipedriveFieldCreator } from './AdminPipedriveFieldCreator';
import { AdminPipedriveSyncQueueManager } from './AdminPipedriveSyncQueueManager';
import { BulkPipedriveReQueue } from './BulkPipedriveReQueue';
import { Alert, AlertDescription } from '@/components/ui/alert';

const FIELD_NAMES = [
  // Core IDs & Status
  { name: 'supabase_id', label: 'Supabase ID' },
  { name: 'prospect_status', label: 'Prospect Status' },
  
  // Professional Details
  { name: 'years_experience', label: 'Years Experience' },
  { name: 'current_listings', label: 'Current Listings' },
  { name: 'total_sales', label: 'Total Sales' },
  { name: 'license_number', label: 'License Number' },
  { name: 'business_name', label: 'Business/Brokerage Name' },
  { name: 'specialty', label: 'Specialties' },
  { name: 'website', label: 'Website' },
  { name: 'rank', label: 'Top10Lists Rank' },
  { name: 'synthesized_bio', label: 'Bio' },
  
  // Badges & Status
  { name: 'is_top_agent', label: 'Is Top Agent' },
  { name: 'is_premier_agent', label: 'Is Premier Agent' },
  { name: 'is_brand_builder', label: 'Is Brand Builder' },
  { name: 'email_verified', label: 'Email Verified' },
  
  // Location
  { name: 'city_name', label: 'City' },
  { name: 'state', label: 'State' },
  
  // Zillow Data
  { name: 'zillow_position', label: 'Zillow Position' },
  { name: 'zillow_page', label: 'Zillow Page' },
  { name: 'agents_ahead', label: 'Agents Ahead' },
  { name: 'zillow_total_agents', label: 'Zillow Total Agents' },
  { name: 'zillow_rating', label: 'Zillow Rating' },
  { name: 'zillow_reviews', label: 'Zillow Reviews' },
  { name: 'zillow_profile_url', label: 'Zillow Profile URL' },
  
  // URLs
  { name: 'profile_link', label: 'Profile Link (Top10Lists Agent Funnel)' },
  { name: 'card_url', label: 'Top10Lists Card URL' },
];

export default function AdminPipedriveFields() {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [savedFields, setSavedFields] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingFields, setIsFetchingFields] = useState(false);
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const { toast } = useToast();
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchFields();
  }, []);

  // Check if there are unsaved changes
  const hasUnsavedChanges = Object.keys(fields).some(
    key => fields[key] !== (savedFields[key] || '')
  ) || Object.keys(savedFields).some(
    key => savedFields[key] !== (fields[key] || '')
  );

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
      setSavedFields(mapping);
    }
  };

  const handleSave = useCallback(async (showToast = true) => {
    setIsSaving(true);
    const errors: string[] = [];
    const savedFieldNames: string[] = [];
    
    try {
      const fieldsToSave = Object.entries(fields).filter(([_, pipedriveKey]) => pipedriveKey);
      
      for (const [fieldName, pipedriveKey] of fieldsToSave) {
        const { error } = await supabase.from('pipedrive_field_mapping').upsert(
          { field_name: fieldName, pipedrive_key: pipedriveKey },
          { onConflict: 'field_name' }
        );
        
        if (error) {
          console.error(`Failed to save ${fieldName}:`, error);
          errors.push(`${fieldName}: ${error.message}`);
        } else {
          savedFieldNames.push(fieldName);
        }
      }

      if (errors.length > 0) {
        toast({
          title: `Saved ${savedFieldNames.length} fields, ${errors.length} failed`,
          description: errors.slice(0, 3).join('; ') + (errors.length > 3 ? '...' : ''),
          variant: 'destructive',
        });
      } else {
        setSavedFields({ ...fields });
        setLastSaved(new Date());
        if (showToast) {
          toast({ title: `Saved ${savedFieldNames.length} field mappings!` });
        }
      }
    } catch (error: any) {
      toast({
        title: 'Save Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [fields, toast]);

  // Auto-save after 2 seconds of no changes
  const handleFieldChange = (fieldName: string, value: string) => {
    setFields(prev => ({ ...prev, [fieldName]: value }));
    
    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Set new auto-save timeout
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSave(false);
    }, 2000);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  const fetchPipedriveFields = async () => {
    setIsFetchingFields(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-pipedrive-fields');

      if (error) throw error;

      if (data?.success) {
        setAvailableFields(data.fields);
        toast({ 
          title: 'Fields fetched!', 
          description: `Found ${data.fields.length} custom fields` 
        });
      }
    } catch (error: any) {
      toast({
        title: 'Fetch Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsFetchingFields(false);
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

      <AdminPipedriveSyncQueueManager />

      <BulkPipedriveReQueue />

      <AdminPipedriveFieldCreator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Custom Field Keys
            {hasUnsavedChanges && (
              <span className="text-sm text-amber-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Unsaved changes (auto-saving...)
              </span>
            )}
            {!hasUnsavedChanges && lastSaved && (
              <span className="text-sm text-green-500 flex items-center gap-1">
                <Check className="h-4 w-4" />
                Saved
              </span>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter the Pipedrive API keys for each custom field. Changes are auto-saved after 2 seconds.
            Find keys in Pipedrive: Settings → Data fields → Person → Click field → Copy API key.
          </p>
          <Button 
            variant="outline" 
            onClick={fetchPipedriveFields}
            disabled={isFetchingFields}
            className="mt-2"
          >
            {isFetchingFields ? 'Fetching...' : 'Fetch Available Fields from Pipedrive'}
          </Button>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Fields are auto-saved 2 seconds after you stop typing. You can also click "Save Mappings" to save immediately.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            {FIELD_NAMES.map(({ name, label }) => (
              <div key={name} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <label className="font-medium">{label}</label>
                <div className="relative">
                  <Input
                    placeholder="e.g., abc123def456..."
                    value={fields[name] || ''}
                    onChange={(e) => handleFieldChange(name, e.target.value)}
                    className={fields[name] !== (savedFields[name] || '') ? 'border-amber-500' : ''}
                  />
                  {fields[name] && fields[name] === savedFields[name] && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                </div>
              </div>
            ))}
          </div>

          <Button className="mt-6" onClick={() => handleSave(true)} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Mappings'}
          </Button>
        </CardContent>
      </Card>

      {availableFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available Pipedrive Fields</CardTitle>
            <p className="text-sm text-muted-foreground">
              Copy the key from below to paste into the field mapping above
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {availableFields.map((field) => (
                <div key={field.key} className="p-3 border rounded-lg">
                  <div className="font-semibold">{field.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Key: <code className="bg-muted px-2 py-1 rounded">{field.key}</code>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Type: {field.field_type}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
            <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
              <li>Supabase ID (Text)</li>
              <li>Years Experience (Number)</li>
              <li>Current Listings (Number)</li>
              <li>Total Sales (Number)</li>
              <li>License Number (Text)</li>
              <li>Business/Brokerage Name (Text)</li>
              <li>Specialties (Text - comma-separated)</li>
              <li>Website (Text)</li>
              <li>Top10Lists Rank (Number)</li>
              <li>Bio (Text - long)</li>
              <li>Is Top Agent (Single option: YES, NO)</li>
              <li>Is Premier Agent (Single option: YES, NO)</li>
              <li>Is Brand Builder (Single option: YES, NO)</li>
              <li>Email Verified (Single option: YES, NO)</li>
              <li>City (Text)</li>
              <li>State (Text)</li>
              <li>Zillow Position (Number)</li>
              <li>Zillow Page (Number)</li>
              <li>Agents Ahead (Number)</li>
              <li>Zillow Total Agents (Number)</li>
              <li>Zillow Rating (Number)</li>
              <li>Zillow Reviews (Number)</li>
              <li>Zillow Profile URL (Text)</li>
              <li>Top10Lists Card URL (Text)</li>
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
