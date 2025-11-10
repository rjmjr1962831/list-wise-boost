import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Database, Upload } from "lucide-react";
import { getProfessionalsByCategory } from "@/data/professionalData";
import { getCityBySlug } from "@/data/cities";
import { getAllCategories } from "@/data/categoryConfig";

const MigrateData = () => {
  const [isMigrating, setIsMigrating] = useState(false);

  const handleMigration = async () => {
    setIsMigrating(true);
    
    try {
      // Get Gilbert and Phoenix city data
      const gilbert = getCityBySlug('gilbert', 'az');
      const phoenix = getCityBySlug('phoenix', 'az');
      const categories = getAllCategories();
      
      if (!gilbert || !phoenix) {
        throw new Error('City data not found');
      }

      // Prepare migration data
      const migrationData = {
        cities: [
          { name: gilbert.name, state: gilbert.state, stateSlug: gilbert.stateSlug, slug: gilbert.slug },
          { name: phoenix.name, state: phoenix.state, stateSlug: phoenix.stateSlug, slug: phoenix.slug },
        ],
        categories: categories.map(cat => ({
          name: cat.name,
          slug: cat.id,
          icon: cat.icon || null,
          pluralName: cat.pluralName,
        })),
        professionals: [],
      };

      // Collect all professionals from both cities
      const allProfs: any[] = [];
      
      // Gilbert professionals
      categories.forEach(category => {
        const gilbertProfs = getProfessionalsByCategory(gilbert, category.id);
        gilbertProfs.forEach((prof, index) => {
          allProfs.push({
            name: prof.name,
            title: prof.title,
            image: prof.image,
            yearsExperience: prof.stats?.yearsExperience || 0,
            specialty: prof.specialties || [],
            phone: prof.phone,
            email: prof.email,
            website: prof.website,
            description: prof.description,
            badges: [],
            cityKey: `${gilbert.stateSlug}/${gilbert.slug}`,
            categorySlug: category.id,
            type: 'established',
            rank: index + 1,
          });
        });
      });

      // Phoenix professionals
      categories.forEach(category => {
        const phoenixProfs = getProfessionalsByCategory(phoenix, category.id);
        phoenixProfs.forEach((prof, index) => {
          allProfs.push({
            name: prof.name,
            title: prof.title,
            image: prof.image,
            yearsExperience: prof.stats?.yearsExperience || 0,
            specialty: prof.specialties || [],
            phone: prof.phone,
            email: prof.email,
            website: prof.website,
            description: prof.description,
            badges: [],
            cityKey: `${phoenix.stateSlug}/${phoenix.slug}`,
            categorySlug: category.id,
            type: 'established',
            rank: index + 1,
          });
        });
      });

      migrationData.professionals = allProfs;

      console.log('Calling migration function with data:', migrationData);

      const { data, error } = await supabase.functions.invoke('migrate-data', {
        body: { data: migrationData },
      });

      if (error) throw error;

      toast.success(data.message || "Data migrated successfully!");
      console.log('Migration result:', data);

    } catch (error: any) {
      console.error('Migration error:', error);
      toast.error("Migration failed: " + error.message);
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Database className="h-16 w-16 text-primary" />
          </div>
          <CardTitle className="text-3xl">Data Migration</CardTitle>
          <CardDescription className="text-lg">
            Import your existing professionals data into the database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h3 className="font-semibold">This will import:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>2 cities (Gilbert, Phoenix)</li>
              <li>All configured categories</li>
              <li>All professionals from your data files</li>
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> This will create new records. If you've already migrated data, 
              cities and categories will be updated, but professionals may be duplicated.
            </p>
          </div>

          <Button 
            onClick={handleMigration} 
            disabled={isMigrating}
            className="w-full"
            size="lg"
          >
            {isMigrating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                Migrating Data...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-5 w-5" />
                Start Migration
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            After migration, you can manage all data through the admin panel
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MigrateData;