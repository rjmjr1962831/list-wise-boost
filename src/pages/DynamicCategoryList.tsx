import { useEffect, useState } from 'react';
import { useParams, Navigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ProfessionalListLayout } from '@/components/ProfessionalListLayout';
import { CollapsibleListSection } from '@/components/CollapsibleListSection';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { generatePageTitle, generateMetaDescription, formatCityName } from '@/utils/routeHelpers';
import { ListSection, Professional } from '@/types/professional';
import { RealEstateAgentQuizModal } from '@/components/RealEstateAgentQuizModal';
import { ContactProfessionalModal } from '@/components/ContactProfessionalModal';
import { AgentDetailModal } from '@/components/AgentDetailModal';
import { Button } from '@/components/ui/button';
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
  zuid: string | null;
  company: string | null;
  current_listings: number | null;
  total_sales: number | null;
  license_number: string | null;
  license_verified_at: string | null;
  zillow_profile_url: string | null;
  zillow_data_fetched_at: string | null;
  review_stars_rating: number | null;
  num_total_reviews: number | null;
  sidebar_video_url: string | null;
  ratings: any | null;
  professional_information: any | null;
  get_to_know_me: string | null;
  agent_sales_stats: any | null;
}

function convertToProfessional(dbProf: DBProfessional): Professional {
  // Use ONLY real stats from database - no fake data generation
  // Rating: Extract from ratings JSONB object (memo23 format)
  const ratingsObj = dbProf.ratings as any;
  const rating = (ratingsObj?.average && typeof ratingsObj.average === 'number' && ratingsObj.average > 0)
    ? ratingsObj.average
    : (typeof dbProf.review_stars_rating === 'number' && dbProf.review_stars_rating > 0)
      ? dbProf.review_stars_rating
      : 0; // 0 indicates no rating available
  
  // Reviews: Use ratings.count or num_total_reviews
  const reviews = (ratingsObj?.count && typeof ratingsObj.count === 'number' && ratingsObj.count > 0)
    ? ratingsObj.count
    : (typeof dbProf.num_total_reviews === 'number' && dbProf.num_total_reviews > 0)
      ? dbProf.num_total_reviews
      : 0; // 0 indicates no reviews available
  
  const stats: Record<string, number | string> = {};
  if (typeof dbProf.years_experience === 'number' && dbProf.years_experience > 0) {
    stats.yearsExperience = dbProf.years_experience;
  }
  
  // Use REAL database values ONLY - no generation
  const currentListings = (typeof dbProf.current_listings === 'number' && dbProf.current_listings > 0)
    ? dbProf.current_listings
    : 0; // 0 indicates no data available
    
  const totalSales = (typeof dbProf.total_sales === 'number' && dbProf.total_sales > 0)
    ? dbProf.total_sales
    : 0; // 0 indicates no data available
    
  if (currentListings > 0) stats.currentListings = currentListings;
  if (totalSales > 0) stats.totalSales = totalSales;
  
  const base: Professional = {
    id: dbProf.id,
    rank: dbProf.rank,
    name: dbProf.name,
    title: dbProf.title || undefined,
    company: dbProf.company || '',
    rating: rating,
    reviews: reviews,
    specialties: dbProf.specialty || [],
    address: (dbProf as any).address || '',
    phone: dbProf.phone || undefined, // Don't show fake phone numbers
    email: dbProf.email || undefined, // Don't show fake emails
    website: dbProf.website || undefined, // Only show real personal websites
    description: (dbProf as any).get_to_know_me || dbProf.description || '',
    stats,
    verified: !!(dbProf.license_number || dbProf.license_verified_at),
    image: dbProf.image_url || '/api/placeholder/400/400',
    testimonials: [], // No fake testimonials - only real reviews from external sources
    zuid: dbProf.zuid || null,
    license_number: dbProf.license_number || undefined,
    license_verified_at: dbProf.license_verified_at || undefined,
  };

  const enriched: any = {
    ...base,
    total_sales: (typeof dbProf.total_sales === 'number' ? dbProf.total_sales : undefined),
    current_listings: (typeof dbProf.current_listings === 'number' ? dbProf.current_listings : undefined),
    years_experience: (typeof dbProf.years_experience === 'number' ? dbProf.years_experience : undefined),
    zillow_data_fetched_at: dbProf.zillow_data_fetched_at || undefined,
    zillow_profile_url: dbProf.zillow_profile_url || undefined,
    sidebar_video_url: dbProf.sidebar_video_url || undefined,
    professional_information: (dbProf as any).professional_information || undefined,
    ratings: dbProf.ratings || undefined,
    get_to_know_me: (dbProf as any).get_to_know_me || undefined,
    agent_sales_stats: (dbProf as any).agent_sales_stats || undefined,
  };

  return enriched;
}

export default function DynamicCategoryList() {
  const { stateSlug, citySlug, categorySlug } = useParams<{ 
    stateSlug: string; 
    citySlug: string; 
    categorySlug: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [isGeneratingData, setIsGeneratingData] = useState(false);
  const [minLoadingComplete, setMinLoadingComplete] = useState(false);
  const [reviewsReady, setReviewsReady] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  const [city, setCity] = useState<City | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [allProfessionals, setAllProfessionals] = useState<Professional[]>([]);
  const [showQuiz, setShowQuiz] = useState(false);
  const [filteredProfessionals, setFilteredProfessionals] = useState<Professional[]>([]);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

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

        // Fetch professionals - ONLY enriched and qualified agents (4.8+ stars, 100+ reviews)
        // SPECIAL CASE: For Scottsdale, always include Beauvais first (even if <100 reviews)
        const cacheBuster = Date.now();
        
        let professionalsData: any[] = [];
        let profsError = null;
        
        if (cityData.slug === 'scottsdale' && categoryData.slug === 'top10realestateagents') {
          // Fetch Beauvais first (special case)
          const { data: beauvaisData, error: beauvaisError } = await supabase
            .from('professionals')
            .select('*')
            .eq('city_id', cityData.id)
            .eq('category_id', categoryData.id)
            .eq('active', true)
            .not('professional_information', 'is', null)
            .ilike('zillow_profile_url', '%beauvais%')
            .limit(1);
          
          // Fetch other qualified agents (excluding Beauvais)
          const { data: otherAgents, error: otherError } = await supabase
            .from('professionals')
            .select('*')
            .eq('city_id', cityData.id)
            .eq('category_id', categoryData.id)
            .eq('active', true)
            .not('professional_information', 'is', null)
            .gte('review_stars_rating', 4.8)
            .gte('num_total_reviews', 100)
            .not('zillow_profile_url', 'ilike', '%beauvais%')
            .order('rank')
            .limit(9);
          
          profsError = beauvaisError || otherError;
          professionalsData = [...(beauvaisData || []), ...(otherAgents || [])];
        } else {
          // Standard query for other cities
          const { data, error } = await supabase
            .from('professionals')
            .select('*')
            .eq('city_id', cityData.id)
            .eq('category_id', categoryData.id)
            .eq('active', true)
            .not('professional_information', 'is', null)
            .gte('review_stars_rating', 4.8)
            .gte('num_total_reviews', 100)
            .order('rank')
            .limit(10);
          
          professionalsData = data || [];
          profsError = error;
        }

        if (profsError) {
          console.error('Error fetching professionals:', profsError);
        }

        // If no professionals found, auto-generate them
        if (!professionalsData || professionalsData.length === 0) {
          console.log('No professionals found, auto-generating...');
          
          // Set flag to show loading animation
          setIsGeneratingData(true);
          setLoading(true);
          
          // Run import in background without blocking
          generateAndInsertProfessionals(cityWithCamelCase, categoryData);
          
          // The polling mechanism below will detect when agents are ready
          // Don't wait for reviews - render immediately
          setReviewsReady(true);
        } else {
          // Start from DB professionals
          let baseProfessionals: DBProfessional[] = professionalsData;

          // Scottsdale & Phoenix special case: ensure Beauvais-Real-Estate is ALWAYS present
          if ((cityData.slug === 'scottsdale' || cityData.slug === 'phoenix') && categoryData.slug === 'top10realestateagents') {
            const hasBeauvais = baseProfessionals.some(p =>
              (p.zuid && p.zuid.toLowerCase().includes('beauvais-real-estate')) ||
              (p.zillow_profile_url && p.zillow_profile_url.toLowerCase().includes('beauvais-real-estate')) ||
              (p.name && p.name.toLowerCase().includes('beauvais'))
            );

            if (!hasBeauvais) {
              console.log(`⚠️ Beauvais-Real-Estate not found in DB results for ${cityData.name}, injecting stub card`);
              const stub: DBProfessional = {
                id: 'beauvais-stub',
                name: 'Beauvais Real Estate',
                title: 'Real Estate Team',
                category_id: categoryData.id,
                city_id: cityData.id,
                rank: 1,
                type: 'team',
                specialty: [],
                years_experience: null,
                badges: [],
                email: null,
                phone: null,
                website: 'https://www.zillow.com/profile/Beauvais-Real-Estate',
                description: 'NA',
                image_url: null,
                zuid: 'Beauvais-Real-Estate',
                company: 'Beauvais Real Estate',
                current_listings: null,
                total_sales: null,
                license_number: null,
                license_verified_at: null,
                zillow_profile_url: 'https://www.zillow.com/profile/Beauvais-Real-Estate',
                zillow_data_fetched_at: null,
                review_stars_rating: null,
                num_total_reviews: null,
                sidebar_video_url: null,
                ratings: null,
                professional_information: [], // non-null so it passes enriched filter
                get_to_know_me: null,
                agent_sales_stats: null,
              } as any;

              baseProfessionals = [stub, ...baseProfessionals];
            }
          }

          // Show all agents immediately - they'll upgrade in real-time as enrichment completes
          let displayAgents = baseProfessionals;
          
          // Deduplicate by zillow_profile_url (keep first occurrence)
          const seenUrls = new Set<string>();
          displayAgents = displayAgents.filter((p: DBProfessional) => {
            const url = p.zillow_profile_url?.toLowerCase() || p.id;
            if (seenUrls.has(url)) {
              console.log(`🗑️ Removing duplicate: ${p.name} (${url})`);
              return false;
            }
            seenUrls.add(url);
            return true;
          });
          
          // Special sorting for Scottsdale: Beauvais-Real-Estate always first
          if ((cityData.slug === 'scottsdale' || cityData.slug === 'phoenix') && categoryData.slug === 'top10realestateagents') {
            const beauvaisIndex = displayAgents.findIndex(p => 
              (p.zuid && p.zuid.toLowerCase().includes('beauvais-real-estate')) ||
              (p.zillow_profile_url && p.zillow_profile_url.toLowerCase().includes('beauvais-real-estate')) ||
              (p.name && p.name.toLowerCase().includes('beauvais'))
            );
            if (beauvaisIndex > 0) {
              const beauvais = displayAgents.splice(beauvaisIndex, 1)[0];
              displayAgents.unshift(beauvais);
              console.log(`✅ Moved Beauvais-Real-Estate to #1 for ${cityData.name} (initial load)`);
            }
          }
          
          const converted = displayAgents.map(convertToProfessional);
          setAllProfessionals(converted);
          setFilteredProfessionals(converted);
          
          // Prefetch reviews with timeout to ensure page renders
          const reviewPrefetchPromise = (async () => {
            try {
              const market = `${cityWithCamelCase.name}, ${cityWithCamelCase.state}`;
              let hasReviews = false;
              // Prefetch reviews for first 5 agents
              const topAgents = displayAgents.slice(0, 5);
              for (const p of topAgents) {
                const [extRes, apifyRes] = await Promise.allSettled([
                  supabase.functions.invoke('fetch-external-reviews', {
                    body: { agentName: p.name, company: p.company ?? undefined, location: market },
                  }),
                  supabase.functions.invoke('fetch-apify-zillow-reviews', {
                    body: { zuid: p.zuid, agentName: p.name, location: market },
                  }),
                ]);
                const extOk = extRes.status === 'fulfilled' && !!extRes.value?.data && Array.isArray(extRes.value.data.reviews) && extRes.value.data.reviews.some((r: any) => (r?.reviewText || '').trim().length > 0);
                const apifyOk = apifyRes.status === 'fulfilled' && !!apifyRes.value?.data && Array.isArray(apifyRes.value.data.reviews) && apifyRes.value.data.reviews.length > 0;
                if (extOk || apifyOk) { hasReviews = true; break; }
              }
            } catch (e) {
              console.warn('Review prefetch failed:', e);
            }
          })();
          
          // Don't wait for reviews - render immediately
          setReviewsReady(true);
          
          // Auto-import Zillow stats if missing for ANY agent
          const needsZillowData = professionalsData.some(p => !p.professional_information);

          if (needsZillowData) {
            console.log('Detected missing Zillow stats, triggering background import...');
            
            toast.info('Fetching latest Zillow stats...', {
              description: 'This will complete in the background'
            });
            
            // Trigger background enrichment using import-city-agents (agenscrape + memo23)
            supabase.functions.invoke('import-city-agents', {
              body: {
                cityId: cityWithCamelCase.id,
                categoryId: categoryData.id
              }
            }).then(({ data, error }) => {
              if (error) {
                console.error('Background import error:', error);
              } else if (data?.success) {
                console.log('Background enrichment complete:', data);
                toast.success(`Enriched ${data.memo23Enriched || 0} agents`, {
                  description: 'Refresh to see updated data',
                  duration: 5000
                });
              }
            }).catch(err => {
              console.error('Background enrichment failed:', err);
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

  // Real-time subscription to update cards as agents get enriched by memo23
  useEffect(() => {
    if (!city?.id || !category?.id) return;

    console.log(`🔴 Setting up realtime for city: ${city.name}, category: ${category.slug}`);

    const channel = supabase
      .channel('professionals-enrichment')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'professionals',
          filter: `city_id=eq.${city.id}`,
        },
        (payload) => {
          console.log('🟢 Realtime update received:', payload.new);
          const updatedProf = payload.new as DBProfessional;
          
          // Process all updates for current category (enrichment status doesn't matter)
          if (updatedProf.category_id === category.id) {
            const convertedProf = convertToProfessional(updatedProf);
            
            // Add new enriched agent or update existing
            setAllProfessionals(prev => {
              const index = prev.findIndex(p => p.id === updatedProf.id);
              
              if (index === -1) {
                // New agent enriched - add to list
                console.log(`➕ Adding newly enriched ${convertedProf.name}`);
                const newList = [...prev, convertedProf];
                
                // Apply Scottsdale special sorting
                if ((city?.slug === 'scottsdale' || city?.slug === 'phoenix') && category?.slug === 'top10realestateagents') {
                  const beauvaisIdx = newList.findIndex(p => 
                    ((p as any).zuid && (p as any).zuid.toLowerCase().includes('beauvais-real-estate')) ||
                    ((p as any).zillow_profile_url && (p as any).zillow_profile_url.toLowerCase().includes('beauvais-real-estate')) ||
                    (p.name && p.name.toLowerCase().includes('beauvais'))
                  );
                  if (beauvaisIdx > 0) {
                    const beauvais = newList.splice(beauvaisIdx, 1)[0];
                    newList.unshift(beauvais);
                    console.log(`✅ Moved Beauvais-Real-Estate to #1 for ${city?.name} (realtime)`);
                  }
                }
                
                return newList;
              } else {
                // Update existing agent
                const newProfs = [...prev];
                newProfs[index] = convertedProf;
                console.log(`✅ Updated ${convertedProf.name} in allProfessionals`);
                return newProfs;
              }
            });
            
            setFilteredProfessionals(prev => {
              const index = prev.findIndex(p => p.id === updatedProf.id);
              
              if (index === -1) {
                // New agent enriched - add to list
                const newList = [...prev, convertedProf];
                
                // Apply Scottsdale special sorting
                if (city?.slug === 'scottsdale' && category?.slug === 'top10realestateagents') {
                  const beauvaisIdx = newList.findIndex(p => 
                    (p as any).zillow_profile_url?.includes('Beauvais-Real-Estate')
                  );
                  if (beauvaisIdx > 0) {
                    const beauvais = newList.splice(beauvaisIdx, 1)[0];
                    newList.unshift(beauvais);
                  }
                }
                
                return newList;
              } else {
                // Update existing
                const newProfs = [...prev];
                newProfs[index] = convertedProf;
                console.log(`✅ Updated ${convertedProf.name} in filteredProfessionals`);
                return newProfs;
              }
            });
            
            toast.success(`${updatedProf.name} enriched`, {
              description: 'Profile data updated in real-time'
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      console.log('🔴 Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [city?.id, category?.id]);

  const generateAndInsertProfessionals = async (cityData: City, categoryData: Category) => {
    if (categoryData.slug !== 'top10realestateagents') {
      toast.info(`No listings available yet for ${categoryData.plural_name} in ${cityData.name}.`, {
        description: 'We will only display verified data when available.'
      });
      return;
    }

    // Use import-city-agents for all cities (handles agenscrape + memo23 enrichment)
    console.log('Using import-city-agents for', cityData.name);
    
    // Start polling for agents immediately
    startPollingForAgents(cityData.id, categoryData.id);
    
    const { data, error } = await supabase.functions.invoke('import-city-agents', {
      body: {
        cityId: cityData.id,
        categoryId: categoryData.id
      }
    });

    if (error) {
      console.error('Import error:', error);
      toast.error('Import Failed', {
        description: error.message || 'Failed to import agents'
      });
      setImportComplete(true); // Stop showing interstitial on error
    } else {
      console.log('Import result:', data);
      if (data?.success) {
        toast.success('Import Complete', {
          description: `${data.agenscrapeImported} profiles, ${data.memo23Enriched} enriched`
        });
        // Polling will detect the agents and set importComplete
      }
    }
  };

  // Poll database to check if agents have been imported
  const startPollingForAgents = (cityId: string, categoryId: string) => {
    console.log('🔄 Starting to poll for imported agents...');
    
    const pollInterval = setInterval(async () => {
      console.log('📊 Checking for agents in database...');
      
      const { data: agents, error } = await supabase
        .from('professionals')
        .select('id')
        .eq('city_id', cityId)
        .eq('category_id', categoryId)
        .eq('active', true)
        .limit(1);
      
      if (error) {
        console.error('Poll error:', error);
        return;
      }
      
      if (agents && agents.length > 0) {
        console.log('✅ Agents found! Import complete.');
        setImportComplete(true);
        clearInterval(pollInterval);
        
        // Refresh the page to load the agents
        window.location.reload();
      }
    }, 3000); // Poll every 3 seconds
    
    // Stop polling after 2 minutes max
    setTimeout(() => {
      clearInterval(pollInterval);
      if (!importComplete) {
        console.warn('⏱️ Polling timeout - stopping after 2 minutes');
        setImportComplete(true);
        toast.error('Import taking longer than expected', {
          description: 'Please refresh the page manually'
        });
      }
    }, 120000);
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

  // Handle query parameter for direct agent links
  useEffect(() => {
    const agentId = searchParams.get('agent');
    if (agentId && allProfessionals.length > 0) {
      const agent = allProfessionals.find(p => p.id === agentId);
      if (agent) {
        // Scroll to agent card
        setTimeout(() => {
          const element = document.getElementById(`agent-${agentId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        
        // Open detail modal
        setSelectedProfessional(agent);
        setShowDetailModal(true);
      }
    }
  }, [searchParams, allProfessionals]);

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

  // Background polling to auto-populate when import finishes
  useEffect(() => {
    if (!city || !category) return;
    if (category.slug !== 'top10realestateagents') return;
    if (allProfessionals.length > 0) return;

    let attempts = 0;
    const maxAttempts = 60; // ~5 minutes at 5s interval

    const interval = setInterval(async () => {
      attempts++;
      try {
        const { data } = await supabase
          .from('professionals')
          .select('*')
          .eq('city_id', city.id)
          .eq('category_id', category.id)
          .eq('active', true)
          .order('rank');

        if (data && data.length > 0) {
          // Show all agents - they'll upgrade via realtime as enrichment completes
          let displayAgents = data;
          
          // Deduplicate by zillow_profile_url (keep first occurrence)
          const seenUrls = new Set<string>();
          displayAgents = displayAgents.filter((p: any) => {
            const url = p.zillow_profile_url?.toLowerCase() || p.id;
            if (seenUrls.has(url)) {
              console.log(`🗑️ Removing duplicate in polling: ${p.name} (${url})`);
              return false;
            }
            seenUrls.add(url);
            return true;
          });
          
          // Special sorting for Scottsdale & Phoenix: Beauvais-Real-Estate always first
          if ((city.slug === 'scottsdale' || city.slug === 'phoenix') && category.slug === 'top10realestateagents') {
            const beauvaisIndex = displayAgents.findIndex((p: any) => 
              p.zillow_profile_url?.includes('Beauvais-Real-Estate')
            );
            if (beauvaisIndex > 0) {
              const beauvais = displayAgents.splice(beauvaisIndex, 1)[0];
              displayAgents.unshift(beauvais);
              console.log(`✅ Moved Beauvais-Real-Estate to #1 for ${city.name} (polling)`);
            }
          }
          
          const converted = displayAgents.map(convertToProfessional);
          setAllProfessionals(converted);
          setFilteredProfessionals(converted);
          setLoading(false);
          setIsGeneratingData(false);
          setReviewsReady(true);
          clearInterval(interval);
        }
      } catch (e) {
        console.warn('Polling professionals failed:', e);
      } finally {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [city, category, allProfessionals.length]);


  // Generate structured data for LLM/SEO
  useEffect(() => {
    if (!city || !category || allProfessionals.length === 0) return;

    const structuredData = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": `Top 10 ${category.plural_name} in ${city.name}, ${city.state}`,
      "description": `AI and human curated list of the top 10 ${category.plural_name.toLowerCase()} in ${city.name}, ${city.state}. Qualified with 4.8+ star ratings and 100+ verified reviews.`,
      "url": `https://top10lists.us/${city.state_slug}/${city.slug}/${category.slug}`,
      "numberOfItems": allProfessionals.length,
      "itemListElement": allProfessionals.slice(0, 10).map((agent, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
          "@type": "RealEstateAgent",
          "@id": `https://top10lists.us/agent/${agent.id}`,
          "name": agent.name,
          "description": agent.description || `Professional ${category.name.toLowerCase()} serving ${city.name}, ${city.state}`,
          "email": agent.email || undefined,
          "telephone": agent.phone || undefined,
          "url": agent.website || undefined,
          "image": agent.image || undefined,
          "address": agent.address ? {
            "@type": "PostalAddress",
            "streetAddress": agent.address,
            "addressLocality": city.name,
            "addressRegion": city.state
          } : undefined,
          "areaServed": {
            "@type": "City",
            "name": city.name,
            "containedInPlace": {
              "@type": "State",
              "name": city.state
            }
          },
          "knowsAbout": agent.specialties || [],
          "aggregateRating": agent.rating > 0 ? {
            "@type": "AggregateRating",
            "ratingValue": agent.rating,
            "reviewCount": agent.reviews,
            "bestRating": 5,
            "worstRating": 1
          } : undefined,
          "yearsInOperation": agent.stats?.yearsExperience || undefined,
          "memberOf": agent.company ? {
            "@type": "Organization",
            "name": agent.company
          } : undefined
        }
      }))
    };

    // Inject structured data into document head
    const scriptId = 'structured-data-jsonld';
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    
    script.textContent = JSON.stringify(structuredData);

    return () => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [city, category, allProfessionals]);

  if (loading || (isGeneratingData && !importComplete) || !reviewsReady) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-8 bg-gradient-to-b from-primary/5 to-background">
        <div className="flex flex-col items-center gap-8 text-center max-w-2xl">
          {isGeneratingData ? (
            <>
              {/* Prominent Header */}
              <div className="space-y-4">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 animate-pulse">
                  <span className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" aria-hidden="true" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                  Analyzing Agent Data
                </h2>
              </div>

              {/* Data Points Counter - Prominent */}
              <div className="bg-card border-2 border-primary/20 rounded-2xl p-8 shadow-xl animate-scale-in">
                <div className="space-y-2">
                  <p className="text-sm uppercase tracking-wide text-muted-foreground font-semibold">
                    Processing
                  </p>
                  <AnimatedCounter 
                    target={2000000}
                    duration={8}
                    isLoading={isGeneratingData}
                    className="text-5xl md:text-6xl font-bold text-primary"
                  />
                  <p className="text-lg text-muted-foreground">
                    data points across multiple sources
                  </p>
                </div>
              </div>

              {/* What We're Checking */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                <div className="bg-card/50 border border-border rounded-lg p-4 animate-fade-in">
                  <div className="text-2xl mb-2">📊</div>
                  <p className="text-sm font-medium text-foreground">Sales History</p>
                  <p className="text-xs text-muted-foreground">Transaction records</p>
                </div>
                <div className="bg-card/50 border border-border rounded-lg p-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                  <div className="text-2xl mb-2">⭐</div>
                  <p className="text-sm font-medium text-foreground">Reviews & Ratings</p>
                  <p className="text-xs text-muted-foreground">Client feedback</p>
                </div>
                <div className="bg-card/50 border border-border rounded-lg p-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                  <div className="text-2xl mb-2">🏆</div>
                  <p className="text-sm font-medium text-foreground">Market Performance</p>
                  <p className="text-xs text-muted-foreground">Recent activity</p>
                </div>
              </div>

              {/* City Context */}
              <p className="text-lg text-muted-foreground max-w-xl">
                Finding the top real estate agents in <span className="font-semibold text-foreground">{city?.name}</span> based on comprehensive market data
              </p>
            </>
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground">
              <span className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" aria-hidden="true" />
              <span className="text-lg font-medium">Loading agents…</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!city || !category) {
    return <Navigate to="/404" replace />;
  }

  if (allProfessionals.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">No Listings Yet</h2>
          <p className="text-muted-foreground mb-6">
            We're importing real agents for {city.name}. This takes a moment—no placeholders will be shown.
          </p>
          <Button
            onClick={() => window.location.reload()}
            variant="default"
            size="lg"
          >
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  // Take first 10 qualifying professionals, then split into Individual Agents and Teams & Groups
  const topTenProfessionals = filteredProfessionals.slice(0, 10);
  
  const individualProfessionals = topTenProfessionals.filter(p => {
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
  });
  
  const teamProfessionals = topTenProfessionals.filter(p => {
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
  });

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
        <>
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
          <AgentDetailModal
            professional={selectedProfessional}
            open={showDetailModal}
            onOpenChange={(open) => {
              setShowDetailModal(open);
              if (!open) {
                // Remove query parameter when modal closes
                searchParams.delete('agent');
                setSearchParams(searchParams);
              }
            }}
            market={formatCityName(city)}
            stateAbbr={metadata.location.stateAbbr}
            agentType={(selectedProfessional as any).type || 'Individual'}
            citySlug={city.slug}
            categorySlug={categorySlug}
          />
        </>
      )}
      <ProfessionalListLayout
        key={`professionals-${allProfessionals.length}-${Date.now()}`}
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
