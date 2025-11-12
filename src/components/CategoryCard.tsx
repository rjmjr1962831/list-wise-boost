import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CategoryConfig } from '@/types/directory';
import { City } from '@/types/directory';
import { generateCategoryUrl } from '@/utils/routeHelpers';
import * as Icons from 'lucide-react';
import { useGA4Tracking } from '@/hooks/useGA4Tracking';

interface CategoryCardProps {
  category: CategoryConfig;
  city: City;
  professionalCount: number;
}

export const CategoryCard = ({ category, city, professionalCount }: CategoryCardProps) => {
  const { trackEvent } = useGA4Tracking();
  const IconComponent = (Icons as any)[category.icon] || Icons.Circle;
  
  const handleClick = () => {
    trackEvent('list_filter_applied', {
      filter_type: 'Category',
      filter_value: category.pluralName,
      market: `${city.name}, ${city.state}`
    });
  };

  return (
    <Link 
      to={generateCategoryUrl(city, category.id)}
      onClick={handleClick}
      className="block transition-all duration-300 hover:scale-105"
    >
      <Card className="h-full hover:shadow-lg border-2 hover:border-primary/50">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-lg bg-${category.accentColor}-100 dark:bg-${category.accentColor}-900/20`}>
              <IconComponent className={`h-6 w-6 text-${category.accentColor}-600 dark:text-${category.accentColor}-400`} />
            </div>
            <Badge variant="secondary" className="text-xs">
              {professionalCount.toLocaleString('en-US', { maximumFractionDigits: 0 })} Listed
            </Badge>
          </div>
          <h3 className="text-xl font-semibold mb-2">{category.pluralName}</h3>
          <p className="text-sm text-muted-foreground">{category.description}</p>
        </CardContent>
      </Card>
    </Link>
  );
};
