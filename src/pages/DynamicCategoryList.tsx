import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ProfessionalListLayout } from '@/components/ProfessionalListLayout';
import { CollapsibleListSection } from '@/components/CollapsibleListSection';
import { generatePageTitle, generateMetaDescription, formatCityName } from '@/utils/routeHelpers';
import { ListSection, Professional } from '@/types/professional';
import { RealEstateAgentQuizModal } from '@/components/RealEstateAgentQuizModal';
import { generateProfessionals } from '@/utils/professionalGenerator';
import { toast } from 'sonner';

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
  
  return {
    rank: dbProf.rank,
    name: dbProf.name,
    title: dbProf.title || undefined,
    company: 'Local Professional',
    rating: rating,
    reviews: reviews,
    specialties: dbProf.specialty || [],
    address: '123 Main St',
    phone: dbProf.phone || '(555) 555-5555',
    email: dbProf.email || 'contact@example.com',
    website: dbProf.website || 'https://example.com',
    description: dbProf.description || 'Experienced professional',
    stats: { yearsExperience: dbProf.years_experience || 5 },
    verified: true,
    image: dbProf.image_url || '/api/placeholder/400/400',
    testimonials: testimonialTemplates
  };
}

export default function DynamicCategoryList() {
  const { stateSlug, citySlug, categorySlug } = useParams<{ 
    stateSlug: string; 
    citySlug: string; 
    categorySlug: string;
  }>();
  
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState<City | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [allProfessionals, setAllProfessionals] = useState<Professional[]>([]);
  const [showQuiz, setShowQuiz] = useState(false);
  const [filteredProfessionals, setFilteredProfessionals] = useState<Professional[]>([]);
  const [quizCompleted, setQuizCompleted] = useState(false);

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
          await generateAndInsertProfessionals(cityWithCamelCase, categoryData);
          
          // Refetch after insertion
          const { data: newProfsData } = await supabase
            .from('professionals')
            .select('*')
            .eq('city_id', cityData.id)
            .eq('category_id', categoryData.id)
            .eq('active', true)
            .order('rank');

          if (newProfsData && newProfsData.length > 0) {
            const converted = newProfsData.map(convertToProfessional);
            setAllProfessionals(converted);
            setFilteredProfessionals(converted);
          }
        } else {
          const converted = professionalsData.map(convertToProfessional);
          setAllProfessionals(converted);
          setFilteredProfessionals(converted);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error in fetchData:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [stateSlug, citySlug, categorySlug]);

  const generateAndInsertProfessionals = async (cityData: City, categoryData: Category) => {
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

  // Check if quiz should be shown for real estate agents category
  useEffect(() => {
    if (categorySlug === 'top10realestateagents' && city && allProfessionals.length > 0) {
      const storageKey = `quiz_completed_${city.slug}_top10realestateagents`;
      const completed = localStorage.getItem(storageKey);
      
      if (!completed) {
        setShowQuiz(true);
      } else {
        setQuizCompleted(true);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading professionals...</p>
        </div>
      </div>
    );
  }

  if (!city || !category) {
    return <Navigate to="/404" replace />;
  }

  if (allProfessionals.length === 0) {
    return <Navigate to={`/${city.state_slug}/${city.slug}`} replace />;
  }

  const sections: ListSection[] = [
    {
      title: `Top ${category.plural_name}`,
      description: quizCompleted && categorySlug === 'top10realestateagents'
        ? `Agents matched to your preferences in ${formatCityName(city)}`
        : `The highest-rated ${category.plural_name.toLowerCase()} in ${formatCityName(city)}`,
      items: filteredProfessionals,
      accentColor: "primary" as const
    }
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
            citySlug={city.slug}
            categorySlug={categorySlug}
          />
        ))}
      </ProfessionalListLayout>
    </>
  );
}
