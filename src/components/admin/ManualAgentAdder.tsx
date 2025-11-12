import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';

interface City {
  id: string;
  name: string;
  state: string;
}

interface Category {
  id: string;
  name: string;
}

export function ManualAgentAdder() {
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    website: '',
    company: '',
    phone: '',
    email: '',
    yearsExperience: '',
    description: '',
    cityId: '',
    categoryId: '',
    type: 'individual' as 'individual' | 'team',
  });

  useEffect(() => {
    fetchCitiesAndCategories();
  }, []);

  const fetchCitiesAndCategories = async () => {
    const { data: citiesData } = await supabase
      .from('cities')
      .select('*')
      .eq('active', true)
      .order('state', { ascending: true })
      .order('name', { ascending: true });

    const { data: categoriesData } = await supabase
      .from('categories')
      .select('*')
      .eq('active', true)
      .order('name', { ascending: true });

    if (citiesData) setCities(citiesData);
    if (categoriesData) setCategories(categoriesData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const scrapeZillowProfile = async (profileUrl: string, agentName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-zillow-profile-stats', {
        body: { profileUrl, agentName }
      });

      if (error) throw error;

      if (data?.success && data?.stats) {
        return {
          currentListings: data.stats.currentListings || 0,
          totalSales: data.stats.totalSales || 0,
          yearsExperience: data.stats.yearsExperience || 0,
          zuid: data.zuid || null
        };
      }
    } catch (error) {
      console.error('Error scraping Zillow profile:', error);
    }
    return null;
  };

  const handleAddAgent = async () => {
    if (!formData.name || !formData.website || !formData.cityId || !formData.categoryId) {
      toast.error('Please fill in all required fields');
      return;
    }

    const yearsExp = parseInt(formData.yearsExperience) || 0;

    setIsLoading(true);

    try {
      // Auto-detect if it's a team based on name or website
      const nameLower = formData.name.toLowerCase();
      const websiteLower = formData.website.toLowerCase();
      const isTeam = nameLower.includes('team') || 
                     nameLower.includes('group') || 
                     nameLower.includes(' & ') ||
                     websiteLower.includes('team') || 
                     websiteLower.includes('group');
      
      // Override user selection if we detect team indicators
      const finalType = isTeam ? 'team' : formData.type;

      // Get next rank for this city/category/type
      const { data: existingAgents } = await supabase
        .from('professionals')
        .select('rank')
        .eq('city_id', formData.cityId)
        .eq('category_id', formData.categoryId)
        .eq('type', formData.type)
        .order('rank', { ascending: false })
        .limit(1);

      const nextRank = existingAgents && existingAgents.length > 0 
        ? existingAgents[0].rank + 1 
        : 1;

      // Scrape Zillow profile for stats
      let zillowData = null;
      if (formData.website.includes('zillow.com')) {
        toast.info('Scraping Zillow profile for statistics...');
        zillowData = await scrapeZillowProfile(formData.website, formData.name);
      }

      // Upload placeholder image
      const placeholderResponse = await fetch('/placeholder.svg');
      const placeholderBlob = await placeholderResponse.blob();
      const fileName = `${formData.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.svg`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('professional-photos')
        .upload(fileName, placeholderBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('professional-photos')
        .getPublicUrl(fileName);

      // Insert agent
      const agentData = {
        name: formData.name,
        company: formData.company || null,
        phone: formData.phone || null,
        email: formData.email || null,
        website: formData.website,
        image_url: publicUrl,
        description: formData.description || `Professional ${finalType === 'team' ? 'real estate team' : 'individual agent'} in the area.`,
        city_id: formData.cityId,
        category_id: formData.categoryId,
        type: finalType,
        rank: nextRank,
        active: true,
        years_experience: yearsExp > 0 ? yearsExp : null,
        current_listings: zillowData?.currentListings || 0,
        total_sales: zillowData?.totalSales || 0,
        zuid: zillowData?.zuid || null,
      };

      const { error: insertError } = await supabase
        .from('professionals')
        .insert(agentData);

      if (insertError) throw insertError;

      toast.success(`Successfully added ${formData.name} to the list!`);
      
      // Reset form
      setFormData({
        name: '',
        website: '',
        company: '',
        phone: '',
        email: '',
        yearsExperience: '',
        description: '',
        cityId: formData.cityId, // Keep city/category selected
        categoryId: formData.categoryId,
        type: 'individual',
      });

    } catch (error) {
      console.error('Error adding agent:', error);
      toast.error('Failed to add agent');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manually Add Agent</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Select value={formData.cityId} onValueChange={(value) => handleInputChange('cityId', value)}>
                <SelectTrigger id="city">
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}, {city.state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={formData.categoryId} onValueChange={(value) => handleInputChange('categoryId', value)}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Agent Type *</Label>
            <Select value={formData.type} onValueChange={(value: 'individual' | 'team') => handleInputChange('type', value)}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual Agent</SelectItem>
                <SelectItem value="team">Team or Group</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              System will auto-detect teams based on name/URL
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Agent Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="John Smith"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Zillow Profile URL *</Label>
            <Input
              id="website"
              value={formData.website}
              onChange={(e) => handleInputChange('website', e.target.value)}
              placeholder="https://www.zillow.com/profile/..."
            />
            <p className="text-xs text-muted-foreground">
              Can be individual or team profile
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="yearsExperience">Years Experience (optional)</Label>
            <Input
              id="yearsExperience"
              type="number"
              value={formData.yearsExperience}
              onChange={(e) => handleInputChange('yearsExperience', e.target.value)}
              placeholder="Enter years of experience"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Company/Brokerage</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => handleInputChange('company', e.target.value)}
              placeholder="ABC Realty"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="agent@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Bio/Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Professional agent with expertise in..."
              rows={3}
            />
          </div>

          <Button 
            onClick={handleAddAgent} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding Agent...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Agent to List
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
