import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Link2, Download, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface VerificationLink {
  id: string;
  name: string;
  email: string;
  phone: string;
  verification_link: string;
  token: string;
}

export function VerificationLinkGenerator() {
  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState<VerificationLink[]>([]);
  const [cityId, setCityId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [cities, setCities] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    loadFilters();
  }, []);

  async function loadFilters() {
    const { data: citiesData } = await supabase
      .from('cities')
      .select('id, name, state')
      .eq('active', true)
      .order('name');
    
    const { data: categoriesData } = await supabase
      .from('categories')
      .select('id, name')
      .eq('active', true)
      .order('name');

    if (citiesData) setCities(citiesData);
    if (categoriesData) setCategories(categoriesData);
  }

  async function generateLinks(regenerate = false) {
    try {
      setLoading(true);
      console.log('🔗 Generating verification links...');

      const { data, error } = await supabase.functions.invoke('generate-verification-links', {
        body: { cityId, categoryId, regenerate }
      });

      if (error) throw error;

      setLinks(data.links);
      
      toast.success(`✅ Generated ${data.total} verification links!`, {
        description: regenerate 
          ? `Regenerated ${data.generated} new tokens`
          : `${data.generated} new tokens created`
      });

    } catch (error: any) {
      console.error('Error generating links:', error);
      toast.error('Failed to generate links', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV() {
    const csv = [
      'Name,Email,Phone,Verification Link',
      ...links.map(link => 
        `"${link.name}","${link.email || ''}","${link.phone || ''}","${link.verification_link}"`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verification-links-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('CSV downloaded!');
  }

  function copyLink(link: string) {
    navigator.clipboard.writeText(link);
    toast.success('Link copied to clipboard!');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verification Link Generator</CardTitle>
        <CardDescription>
          Generate unique profile verification links for agents to use in HubSpot emails/texts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Filter by City</label>
            <Select value={cityId} onValueChange={setCityId}>
              <SelectTrigger>
                <SelectValue placeholder="All cities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All cities</SelectItem>
                {cities.map(city => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}, {city.state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Filter by Category</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={() => generateLinks(false)} 
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Link2 className="mr-2 h-4 w-4" />
                Generate Links
              </>
            )}
          </Button>

          <Button 
            onClick={() => generateLinks(true)} 
            disabled={loading}
            variant="outline"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Regenerate All
          </Button>
        </div>

        {links.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {links.length} verification links generated
              </p>
              <Button onClick={downloadCSV} variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Download CSV
              </Button>
            </div>

            <div className="max-h-96 overflow-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Email</th>
                    <th className="text-left p-2">Phone</th>
                    <th className="text-left p-2">Verification Link</th>
                    <th className="text-left p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => (
                    <tr key={link.id} className="border-b">
                      <td className="p-2">{link.name}</td>
                      <td className="p-2">{link.email || 'N/A'}</td>
                      <td className="p-2">{link.phone || 'N/A'}</td>
                      <td className="p-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {link.verification_link}
                        </code>
                      </td>
                      <td className="p-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyLink(link.verification_link)}
                        >
                          Copy
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}