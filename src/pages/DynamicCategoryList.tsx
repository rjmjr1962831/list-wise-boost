import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ProfessionalListLayout } from '@/components/ProfessionalListLayout';
import { CollapsibleListSection } from '@/components/CollapsibleListSection';
import { generatePageTitle, generateMetaDescription, formatCityName } from '@/utils/routeHelpers';
import { ListSection, Professional } from '@/types/professional';
import { RealEstateAgentQuizModal } from '@/components/RealEstateAgentQuizModal';
import { ContactProfessionalModal } from '@/components/ContactProfessionalModal';
import { generateProfessionals } from '@/utils/professionalGenerator';
import { toast } from 'sonner';
import { LoadingSearch } from '@/components/LoadingSearch';

interface City {
  id: string;
  name: string;
  state: string;
  state_slug: string;
  slug: string;
  stateSlug: string;
}

interface Category {
  id: string;
  name: string;
  plural_name: string;
  slug: string;
}

interface DBProfessional {
  id: string;
  name: string;
  title: string | null;
  category_id: string;
  city_id: string;
  rank: number;
  type: string;
  specialty: string[] | null;
  years_experience: number | null;
  badges: string[] | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  image_url: string | null;
  zuid: string | null;
  company: string | null;
  current_listings: number | null;
  total_sales: number | null;
  license_number: string | null;
  license_verified_at: string | null;
}

function convertToProfessional(dbProf: DBProfessional): Professional {
  // Generate consistent random values based on the professional's ID
  const hash = dbProf.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const seed = hash % 1000;
  
  // Generate rating between 4.5 and 5.0, rounded to 2 decimal places
  const rating = Math.round((4.5 + (seed % 50) / 100) * 100) / 100;
  
  // Generate review count between 50 and 250
  const reviews = 50 + (seed % 200);
  
  // Generate testimonials
  const testimonialTemplates = [
    {
      author: 'Sarah M.',
      text: `Exceptional service! ${dbProf.name} went above and beyond to ensure everything was perfect. Highly recommend their expertise and professionalism.`,
      source: 'Google Reviews',
      date: 'January 2025'
    },
    {
      author: 'Michael R.',
      text: `Working with ${dbProf.name} was a fantastic experience. Their knowledge and attention to detail made the entire process smooth and stress-free.`,
      source: 'Yelp',
      date: 'December 2024'
    },
    {
      author: 'Jennifer L.',
      text: `I couldn't be happier with the results! ${dbProf.name} truly understands client needs and delivers outstanding service every time.`,
      source: 'Facebook',
      date: 'November 2024'
    }
  ];
  
  const stats: Record<string, number | string> = {};
  if (typeof dbProf.years_experience === 'number' && dbProf.years_experience > 0) {
    stats.yearsExperience = dbProf.years_experience;
  }
  // Use DB values when present; otherwise estimate sensible defaults for display
  const currentListings = (typeof dbProf.current_listings === 'number' && dbProf.current_listings > 0)
    ? dbProf.current_listings
    : Math.max(1, Math.floor(reviews / 100));
  const totalSales = (typeof dbProf.total_sales === 'number' && dbProf.total_sales > 0)
    ? dbProf.total_sales
    : Math.floor(reviews / 8);
  stats.currentListings = currentListings;
  stats.totalSales = totalSales;
  
  return {
    id: dbProf.id,
    rank: dbProf.rank,
    name: dbProf.name,
    title: dbProf.title || undefined,
    company: dbProf.company || '',
    rating: rating,
    reviews: reviews,
    specialties: dbProf.specialty || [],
    address: '',
    phone: dbProf.phone || '(555) 555-5555',
    email: dbProf.email || 'contact@example.com',
    website: dbProf.website || 'https://example.com',
    description: dbProf.description || '',
    stats,
    verified: !!(dbProf.license_number || dbProf.license_verified_at),
    image: dbProf.image_url || '/api/placeholder/400/400',
    testimonials: testimonialTemplates,
    zuid: dbProf.zuid || null,
    license_number: dbProf.license_number || undefined,
    license_verified_at: dbProf.license_verified_at || undefined,
  };
}

export default function DynamicCategoryList() {
  const { stateSlug, citySlug, categorySlug } = useParams<{ 
    stateSlug: string; 
    citySlug: string; 
    categorySlug: string;
  }>();
  
  const [loading, setLoading] = useState(true);
  const [isGeneratingData, setIsGeneratingData] = useState(false);
  const [minLoadingComplete, setMinLoadingComplete] = useState(false);
  const [reviewsReady, setReviewsReady] = useState(false);
  const [city, setCity] = useState<City | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [allProfessionals, setAllProfessionals] = useState<Professional[]>([]);
  const [showQuiz, setShowQuiz] = useState(false);
  const [filteredProfessionals, setFilteredProfessionals] = useState<Professional[]>([]);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);

  // Ensure minimum loading time to show the search animation ONLY when generating data
  useEffect(() => {
    if (!isGeneratingData) {
      setMinLoadingComplete(true);
      return;
    }
    
    const timer = setTimeout(() => {
      setMinLoadingComplete(true);
    }, 6500);
    
    return () => clearTimeout(timer);
  }, [isGeneratingData]);

  // Fetch city and category data
  useEffect(() => {
    const fetchData = async () => {
      if (!stateSlug || !citySlug || !categorySlug) return;

      try {
        // Fetch city
        const { data: cityData, error: cityError } = await supabase
          .from('cities')
          .select('*')
          .eq('slug', citySlug)
          .eq('state_slug', stateSlug)
          .eq('active', true)
          .single();

        if (cityError || !cityData) {
          console.error('City not found:', cityError);
          setLoading(false);
          setReviewsReady(true);
          return;
        }

        // Add camelCase property for compatibility
        const cityWithCamelCase = {
          ...cityData,
          stateSlug: cityData.state_slug
        };

        setCity(cityWithCamelCase);

        // Fetch category
        const { data: categoryData, error: categoryError } = await supabase
          .from('categories')
          .select('*')
          .eq('slug', categorySlug)
          .eq('active', true)
          .single();

        if (categoryError || !categoryData) {
          console.error('Category not found:', categoryError);
          setLoading(false);
          setReviewsReady(true);
          return;
        }

        setCategory(categoryData);

        // Fetch professionals
        const { data: professionalsData, error: profsError } = await supabase
          .from('professionals')
          .select('*')
          .eq('city_id', cityData.id)
          .eq('category_id', categoryData.id)
          .eq('active', true)
          .order('rank');

        if (profsError) {
          console.error('Error fetching professionals:', profsError);
        }

        // If no professionals found, auto-generate them
        if (!professionalsData || professionalsData.length === 0) {
          console.log('No professionals found, auto-generating...');
          
          // Set flag to show loading animation
          setIsGeneratingData(true);
          setLoading(true);
          await generateAndInsertProfessionals(cityWithCamelCase, categoryData);
          
          // Refetch after insertion with retry logic
          let retries = 3;
          let newProfsData = null;
          
          while (retries > 0 && (!newProfsData || newProfsData.length === 0)) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between retries
            
            const { data } = await supabase
              .from('professionals')
              .select('*')
              .eq('city_id', cityData.id)
              .eq('category_id', categoryData.id)
              .eq('active', true)
              .order('rank');
            
            newProfsData = data;
            retries--;
          }

          if (newProfsData && newProfsData.length > 0) {
            const converted = newProfsData.map(convertToProfessional);
            setAllProfessionals(converted);
            setFilteredProfessionals(converted);
            setReviewsReady(true);
          } else {
            // No data after retries
            setReviewsReady(true);
          }
        } else {
          const converted = professionalsData.map(convertToProfessional);
          setAllProfessionals(converted);
          setFilteredProfessionals(converted);
          
          // Prefetch reviews for first professional to ensure content is ready
          if (converted.length > 0) {
            const firstProf = professionalsData[0];
            if (firstProf.zuid || (firstProf.name && cityWithCamelCase)) {
              try {
                const market = `${cityWithCamelCase.name}, ${cityWithCamelCase.state}`;
                await supabase.functions.invoke('fetch-apify-zillow-reviews', {
                  body: { zuid: firstProf.zuid, agentName: firstProf.name, location: market }
                });
              } catch (e) {
                console.log('Reviews prefetch attempt completed');
              }
            }
          }
          setReviewsReady(true);
          
          // Auto-import Zillow stats if missing
          const needsZillowData = professionalsData.some(p => 
            (p.total_sales === null || p.total_sales === 0) && 
            (p.current_listings === null || p.current_listings === 0)
          );

          if (needsZillowData) {
            console.log('Detected missing Zillow stats, triggering background import...');
            
            toast.info('Fetching latest Zillow stats...', {
              description: 'This will complete in the background'
            });
            
            // Trigger background import without awaiting
            supabase.functions.invoke('fetch-zillow-agents-bulk', {
              body: {
                city: cityWithCamelCase.name,
                state: cityWithCamelCase.state,
                maxPages: 3,
                categoryId: categoryData.id,
                cityId: cityWithCamelCase.id
              }
            }).then(({ data, error }) => {
              if (error) {
                console.error('Background Zillow import error:', error);
              } else if (data?.success) {
                console.log('Background import complete:', data.summary);
                toast.success(`Updated ${data.summary.updated} agents with latest Zillow stats`, {
                  description: 'Refresh the page to see updated numbers',
                  duration: 5000
                });
              }
            }).catch(err => {
              console.error('Background import failed:', err);
            });
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('Error in fetchData:', error);
        setLoading(false);
        setReviewsReady(true);
      }
    };

    fetchData();
  }, [stateSlug, citySlug, categorySlug]);

  const generateAndInsertProfessionals = async (cityData: City, categoryData: Category) => {
    // For real estate agents, use Zillow auto-import
    if (categoryData.slug === 'top10realestateagents') {
      toast.info(`Importing ${categoryData.plural_name} from Zillow for ${cityData.name}...`);
      
      try {
        const { autoImportZillowAgents } = await import('@/utils/zillowAutoImport');
        const result = await autoImportZillowAgents(
          cityData.id,
          cityData.name,
          cityData.state
        );
        
        if (result.success) {
          toast.success(`Imported ${result.imported} real estate agents from Zillow! Found ${result.licensesFound} license numbers.`);
          // Data will be fetched by the retry logic instead of reloading
        } else {
          toast.error(`Failed to import agents: ${result.errors.join(', ')}`);
        }
        return;
      } catch (error: any) {
        console.error('Error importing from Zillow:', error);
        toast.error(`Zillow import failed: ${error.message}`);
        return;
      }
    }
    
    // Fall back to fake data generator for other categories
    const generated = generateProfessionals(
      cityData.id,
      cityData.name,
      categoryData.id,
      categoryData.slug,
      '555' // Default area code, can be customized per city
    );

    if (generated.length === 0) {
      toast.error(`Auto-generation not yet supported for ${categoryData.plural_name}`);
      return;
    }

    toast.info(`Creating ${categoryData.plural_name} for ${cityData.name}...`);

    const { error } = await supabase
      .from('professionals')
      .insert(generated);

    if (error) {
      console.error('Error inserting professionals:', error);
      toast.error('Failed to create listings');
    } else {
      toast.success(`Created ${generated.length} ${categoryData.plural_name}!`);
      
      // Send notifications for professionals without photos
      const pageUrl = `${window.location.origin}/${cityData.state_slug}/${cityData.slug}/${categoryData.slug}`;
      
      for (const prof of generated) {
        // Check if professional has placeholder image
        if (prof.image_url === '/api/placeholder/400/400' || !prof.image_url) {
          try {
            await supabase.functions.invoke('notify-missing-photo', {
              body: {
                professionalName: prof.name,
                professionalEmail: prof.email,
                professionalPhone: prof.phone,
                professionalWebsite: prof.website,
                rank: prof.rank,
                category: categoryData.plural_name,
                city: cityData.name,
                state: cityData.state,
                pageUrl: pageUrl
              }
            });
            console.log(`Notification sent for ${prof.name} missing photo`);
          } catch (notifyError) {
            console.error(`Failed to send notification for ${prof.name}:`, notifyError);
          }
        }
      }
    }
  };

  // Check if quiz has been completed for real estate agents category
  useEffect(() => {
    if (categorySlug === 'top10realestateagents' && city && allProfessionals.length > 0) {
      const storageKey = `quiz_completed_${city.slug}_top10realestateagents`;
      const completed = localStorage.getItem(storageKey);
      
      if (completed) {
        setQuizCompleted(true);
        // Apply saved preferences filter if available
        try {
          const preferences = JSON.parse(completed);
          const filtered = allProfessionals.filter(prof => {
            const matchesPropertyType = !preferences.propertyType || 
              prof.specialties?.some(s => s.toLowerCase().includes(preferences.propertyType.toLowerCase()));
            const matchesPriceRange = !preferences.priceRange || 
              prof.specialties?.some(s => s.toLowerCase().includes(preferences.priceRange.toLowerCase()));
            return matchesPropertyType || matchesPriceRange;
          });
          setFilteredProfessionals(filtered.length > 0 ? filtered : allProfessionals);
        } catch {
          setFilteredProfessionals(allProfessionals);
        }
      } else {
        setFilteredProfessionals(allProfessionals);
      }
    } else {
      setFilteredProfessionals(allProfessionals);
    }
  }, [categorySlug, city, allProfessionals]);

  const handleQuizComplete = (preferences: { propertyType: string; priceRange: string; timeline: string }) => {
    if (!city) return;

    // Store completion in localStorage
    const storageKey = `quiz_completed_${city.slug}_top10realestateagents`;
    localStorage.setItem(storageKey, JSON.stringify(preferences));
    
    // Filter professionals based on preferences
    const filtered = allProfessionals.filter(prof => {
      const matchesPropertyType = prof.specialties.some(s => 
        s.toLowerCase().includes(preferences.propertyType.replace('-', ' '))
      );
      const matchesPriceRange = prof.specialties.some(s => 
        s.toLowerCase().includes(preferences.priceRange.replace('-', ' ').replace('k', '')) ||
        s.toLowerCase().includes('luxury') && preferences.priceRange === 'over-1.5m' ||
        s.toLowerCase().includes('first-time') && preferences.priceRange === 'under-500k'
      );
      
      return matchesPropertyType || matchesPriceRange;
    });

    // If no exact matches, show all
    setFilteredProfessionals(filtered.length > 0 ? filtered : allProfessionals);
    setQuizCompleted(true);
    setShowQuiz(false);
    
    // Auto-open contact modal for the selected professional
    if (selectedProfessional) {
      setShowContactModal(true);
    }
  };

  const handleContactClick = (professional: Professional) => {
    setSelectedProfessional(professional);
    
    if (categorySlug === 'top10realestateagents' && !quizCompleted) {
      setShowQuiz(true);
    } else {
      setShowContactModal(true);
    }
  };

  useEffect(() => {
    if (!city || !category) return;

    // GA4 page view
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_title: document.title,
        page_location: window.location.href,
        page_path: window.location.pathname,
        market: formatCityName(city),
        category: category.plural_name
      });
    }
  }, [city, category]);

  if (loading || (isGeneratingData && !minLoadingComplete) || !reviewsReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <LoadingSearch />
      </div>
    );
  }

  if (!city || !category) {
    return <Navigate to="/404" replace />;
  }

  if (allProfessionals.length === 0) {
    return <Navigate to={`/${city.state_slug}/${city.slug}`} replace />;
  }

  // Split professionals into Individual Agents and Teams & Groups
  const individualProfessionals = filteredProfessionals
    .filter(p => {
      // Check database type field or detect from name/company
      const dbType = (p as any).type;
      if (dbType === 'individual') return true;
      if (dbType === 'team') return false;
      // Fallback: detect from name
      const nameChecks = p.name.toLowerCase();
      const isTeam = nameChecks.includes('team') || 
                     nameChecks.includes('group') || 
                     nameChecks.includes('& ');
      return !isTeam;
    })
    .slice(0, 5);
  
  const teamProfessionals = filteredProfessionals
    .filter(p => {
      // Check database type field or detect from name/company
      const dbType = (p as any).type;
      if (dbType === 'team') return true;
      if (dbType === 'individual') return false;
      // Fallback: detect from name
      const nameChecks = p.name.toLowerCase();
      const isTeam = nameChecks.includes('team') || 
                     nameChecks.includes('group') || 
                     nameChecks.includes('& ');
      return isTeam;
    })
    .slice(0, 5);

  const sections: ListSection[] = [
    ...(individualProfessionals.length > 0 ? [{
      title: "Individual Agents",
      description: `Top individual ${category.plural_name.toLowerCase()} in ${formatCityName(city)}`,
      items: individualProfessionals,
      accentColor: "primary" as const
    }] : []),
    ...(teamProfessionals.length > 0 ? [{
      title: "Teams & Groups",
      description: `Leading real estate teams in ${formatCityName(city)}`,
      items: teamProfessionals,
      accentColor: "sunset-orange" as const
    }] : [])
  ];

  const metadata = {
    title: generatePageTitle(city, category.plural_name),
    description: generateMetaDescription(city, category.plural_name),
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: city.state, path: `/${city.state_slug}` },
      { name: city.name, path: `/${city.state_slug}/${city.slug}` },
      { name: category.plural_name }
    ],
    location: {
      city: city.name,
      state: city.state,
      stateAbbr: city.state_slug.toUpperCase().slice(0, 2)
    },
    profession: {
      singular: category.name,
      plural: category.plural_name,
      schemaType: 'RealEstateAgent'
    }
  };

  return (
    <>
      {categorySlug === 'top10realestateagents' && city && (
        <RealEstateAgentQuizModal
          open={showQuiz}
          onOpenChange={setShowQuiz}
          onComplete={handleQuizComplete}
          city={city.name}
        />
      )}
      {selectedProfessional && city && category && (
        <ContactProfessionalModal
          open={showContactModal}
          onOpenChange={setShowContactModal}
          professionalName={selectedProfessional.name}
          professionalId={`${city.id}-${category.id}-${selectedProfessional.rank}`}
          listingUrl={typeof window !== 'undefined' ? window.location.href : ''}
          citySlug={city.slug}
          categorySlug={categorySlug}
          cityName={city.name}
          categoryName={category.name}
          professionalWebsite={selectedProfessional.website}
        />
      )}
      <ProfessionalListLayout
        metadata={metadata}
        professionals={filteredProfessionals}
      >
        {sections.map((section, index) => (
          <CollapsibleListSection
            key={index}
            section={section}
            defaultOpen={true}
            schemaType="RealEstateAgent"
            market={formatCityName(city)}
            stateAbbr={metadata.location.stateAbbr}
            citySlug={city.slug}
            categorySlug={categorySlug}
            onContactClick={handleContactClick}
            quizCompleted={quizCompleted}
          />
        ))}
      </ProfessionalListLayout>
    </>
  );
}
