import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { ProfessionalListLayout } from '@/components/ProfessionalListLayout';
import { CollapsibleListSection } from '@/components/CollapsibleListSection';
import { getCityBySlug } from '@/data/cities';
import { getCategoryBySlug } from '@/data/categoryConfig';
import { getProfessionalsByCategory } from '@/data/professionalData';
import { generatePageTitle, generateMetaDescription, formatCityName } from '@/utils/routeHelpers';
import { ListSection, Professional } from '@/types/professional';
import { RealtorQuizModal } from '@/components/RealtorQuizModal';

export default function DynamicCategoryList() {
  const { stateSlug, citySlug, categorySlug } = useParams<{ 
    stateSlug: string; 
    citySlug: string; 
    categorySlug: string;
  }>();
  
  const city = getCityBySlug(citySlug || '', stateSlug);
  const category = getCategoryBySlug(categorySlug || '');
  const allProfessionals = city && category ? getProfessionalsByCategory(city, category.id) : [];
  
  const [showQuiz, setShowQuiz] = useState(false);
  const [filteredProfessionals, setFilteredProfessionals] = useState<Professional[]>(allProfessionals);
  const [quizCompleted, setQuizCompleted] = useState(false);

  // Check if quiz should be shown for realtors category
  useEffect(() => {
    if (categorySlug === 'realtors' && city) {
      const storageKey = `quiz_completed_${city.slug}_realtors`;
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
    const storageKey = `quiz_completed_${city.slug}_realtors`;
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
        category: category.pluralName
      });
    }
  }, [city, category]);

  if (!city || !category) {
    return <Navigate to="/404" replace />;
  }

  if (allProfessionals.length === 0) {
    return <Navigate to={`/${city.stateSlug}/${city.slug}`} replace />;
  }

  const sections: ListSection[] = [
    {
      title: `Top ${category.pluralName}`,
      description: quizCompleted && categorySlug === 'realtors'
        ? `Agents matched to your preferences in ${formatCityName(city)}`
        : `The highest-rated ${category.pluralName.toLowerCase()} in ${formatCityName(city)}`,
      items: filteredProfessionals,
      accentColor: "primary" as const
    }
  ];

  const metadata = {
    title: generatePageTitle(city, category.pluralName),
    description: generateMetaDescription(city, category.pluralName),
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: city.state, path: `/${city.stateSlug}` },
      { name: city.name, path: `/${city.stateSlug}/${city.slug}` },
      { name: category.pluralName }
    ],
    location: {
      city: city.name,
      state: city.state,
      stateAbbr: city.stateSlug.toUpperCase().slice(0, 2)
    },
    profession: {
      singular: category.name,
      plural: category.pluralName,
      schemaType: category.schemaType
    }
  };

  return (
    <>
      {categorySlug === 'realtors' && city && (
        <RealtorQuizModal 
          open={showQuiz} 
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
            schemaType={category.schemaType}
            market={formatCityName(city)}
          />
        ))}
      </ProfessionalListLayout>
    </>
  );
}
