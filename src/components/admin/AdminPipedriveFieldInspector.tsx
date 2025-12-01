import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PipedriveField {
  key: string;
  name: string;
  field_type: string;
  is_custom: boolean;
}

interface FieldMapping {
  field_name: string;
  pipedrive_key: string;
}

export function AdminPipedriveFieldInspector() {
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<PipedriveField[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const loadFields = async () => {
    setLoading(true);
    try {
      // Fetch all Pipedrive fields
      const { data: fieldsData, error: fieldsError } = await supabase.functions.invoke(
        'list-pipedrive-fields'
      );

      if (fieldsError) throw fieldsError;

      // Fetch current mappings
      const { data: mappingsData, error: mappingsError } = await supabase
        .from('pipedrive_field_mapping')
        .select('field_name, pipedrive_key');

      if (mappingsError) throw mappingsError;

      setFields(fieldsData.fields || []);
      setMappings(mappingsData || []);

      toast({
        title: 'Fields loaded',
        description: `Found ${fieldsData.fields?.length || 0} Pipedrive fields`,
      });
    } catch (error) {
      console.error('Error loading fields:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load fields',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredFields = fields.filter(
    (f) =>
      (f.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.key?.includes(searchTerm))
  );

  // Find profile_link related fields
  const profileLinkFields = fields.filter(
    (f) =>
      f.name?.toLowerCase().includes('profile') && f.name?.toLowerCase().includes('link')
  );

  const profileLinkMapping = mappings.find((m) => m.field_name === 'profile_link');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipedrive Field Inspector</CardTitle>
        <CardDescription>
          Inspect Pipedrive fields and identify duplicates or misconfigurations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={loadFields} disabled={loading}>
          <Search className="mr-2 h-4 w-4" />
          {loading ? 'Loading...' : 'Load All Fields'}
        </Button>

        {fields.length > 0 && (
          <>
            {/* Profile Link Analysis */}
            {profileLinkFields.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="font-semibold">
                      Found {profileLinkFields.length} "Profile Link" field(s):
                    </div>
                    {profileLinkFields.map((field) => (
                      <div key={field.key} className="ml-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={field.field_type === 'url' ? 'default' : 'destructive'}>
                            {field.field_type}
                          </Badge>
                          <span className="font-mono text-sm">{field.name}</span>
                          {profileLinkMapping?.pipedrive_key === field.key && (
                            <Badge variant="outline">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Mapped
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          Key: {field.key}
                        </div>
                        {field.field_type !== 'url' && (
                          <div className="text-xs text-destructive">
                            ⚠️ Field type should be "url" not "{field.field_type}" for clickable links
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Current Mappings */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Current Field Mappings ({mappings.length})</h3>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {mappings.map((mapping) => {
                  const field = fields.find((f) => f.key === mapping.pipedrive_key);
                  return (
                    <div
                      key={mapping.field_name}
                      className="flex items-center justify-between text-sm p-2 border rounded"
                    >
                      <div>
                        <span className="font-medium">{mapping.field_name}</span>
                        {field && (
                          <Badge variant="outline" className="ml-2">
                            {field.field_type}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">
                        {field?.name || mapping.pipedrive_key}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Search & Browse All Fields */}
            <div>
              <input
                type="text"
                placeholder="Search fields by name or key..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            {searchTerm && (
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {filteredFields.map((field) => {
                  const isMapped = mappings.some((m) => m.pipedrive_key === field.key);
                  return (
                    <div
                      key={field.key}
                      className="flex items-center justify-between text-sm p-2 border rounded"
                    >
                      <div>
                        <span className="font-medium">{field.name}</span>
                        <Badge variant="outline" className="ml-2">
                          {field.field_type}
                        </Badge>
                        {isMapped && (
                          <Badge className="ml-2" variant="secondary">
                            Mapped
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">
                        {field.key}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <Alert>
          <ExternalLink className="h-4 w-4" />
          <AlertDescription>
            <strong>Instructions:</strong>
            <ol className="list-decimal ml-4 mt-2 space-y-1 text-sm">
              <li>
                In Pipedrive, find the duplicate "Profile Link" field and note its field type.
              </li>
              <li>
                If the mapped field is not type "url", you need to change it to URL type in
                Pipedrive settings or map to a different URL field.
              </li>
              <li>
                Delete any duplicate Profile Link fields that aren't being used.
              </li>
              <li>
                The correct field should show clickable URLs like: https://top10lists.us/profile/UUID
              </li>
            </ol>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
