import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { ProfessionalListLayout } from '@/components/ProfessionalListLayout';
import { CollapsibleListSection } from '@/components/CollapsibleListSection';
import { getCityBySlug } from '@/data/cities';
import { getCategoryBySlug } from '@/data/categoryConfig';
import { getProfessionalsByCategory } from '@/data/professionalData';
import { generatePageTitle, generateMetaDescription, formatCityName } from '@/utils/routeHelpers';
import { ListSection } from '@/types/professional';

export default function DynamicCategoryList() {
  const { stateSlug, citySlug, categorySlug } = useParams<{ 
    stateSlug: string; 
    citySlug: string; 
    categorySlug: string;
  }>();
  
  const city = getCityBySlug(citySlug || '', stateSlug);
  const category = getCategoryBySlug(categorySlug || '');
  const professionals = city && category ? getProfessionalsByCategory(city, category.id) : [];

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

  if (professionals.length === 0) {
    return <Navigate to={`/${city.stateSlug}/${city.slug}`} replace />;
  }

  const sections: ListSection[] = [
    {
      title: `Top ${category.pluralName}`,
      description: `The highest-rated ${category.pluralName.toLowerCase()} in ${formatCityName(city)}`,
      items: professionals,
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
    <ProfessionalListLayout
      metadata={metadata}
      professionals={professionals}
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
  );
}
