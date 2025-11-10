import { supabase } from "@/integrations/supabase/client";

export interface City {
  id: string;
  name: string;
  state: string;
  stateSlug: string;
  slug: string;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  pluralName: string;
  active: boolean;
}

export interface Professional {
  id: string;
  name: string;
  title?: string;
  image?: string;
  yearsExperience?: number;
  specialty?: string[];
  phone?: string;
  email?: string;
  website?: string;
  description?: string;
  badges?: string[];
  rank: number;
  type: 'established' | 'emerging';
}

export async function getCityBySlug(stateSlug: string, citySlug: string): Promise<City | null> {
  const { data, error } = await supabase
    .from('cities')
    .select('*')
    .eq('state_slug', stateSlug)
    .eq('slug', citySlug)
    .eq('active', true)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    state: data.state,
    stateSlug: data.state_slug,
    slug: data.slug,
    active: data.active,
  };
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    icon: data.icon,
    pluralName: data.plural_name,
    active: data.active,
  };
}

export async function getProfessionalsByCityAndCategory(
  cityId: string,
  categoryId: string
): Promise<{ established: Professional[]; emerging: Professional[] }> {
  const { data, error } = await supabase
    .from('professionals')
    .select('*')
    .eq('city_id', cityId)
    .eq('category_id', categoryId)
    .eq('active', true)
    .order('rank', { ascending: true });

  if (error || !data) {
    return { established: [], emerging: [] };
  }

  const professionals = data.map(p => ({
    id: p.id,
    name: p.name,
    title: p.title,
    image: p.image_url,
    yearsExperience: p.years_experience,
    specialty: p.specialty,
    phone: p.phone,
    email: p.email,
    website: p.website,
    description: p.description,
    badges: p.badges,
    rank: p.rank,
    type: p.type as 'established' | 'emerging',
  }));

  return {
    established: professionals.filter(p => p.type === 'established'),
    emerging: professionals.filter(p => p.type === 'emerging'),
  };
}

export async function getAllCities(): Promise<City[]> {
  const { data, error } = await supabase
    .from('cities')
    .select('*')
    .eq('active', true)
    .order('state', { ascending: true })
    .order('name', { ascending: true });

  if (error || !data) return [];

  return data.map(d => ({
    id: d.id,
    name: d.name,
    state: d.state,
    stateSlug: d.state_slug,
    slug: d.slug,
    active: d.active,
  }));
}

export async function getAllCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error || !data) return [];

  return data.map(d => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    icon: d.icon,
    pluralName: d.plural_name,
    active: d.active,
  }));
}

export async function getCategoriesForCity(cityId: string): Promise<{ category: Category; count: number }[]> {
  const { data, error } = await supabase
    .from('professionals')
    .select('category_id, categories(*)')
    .eq('city_id', cityId)
    .eq('active', true);

  if (error || !data) return [];

  const categoryCountMap = new Map<string, { category: any; count: number }>();

  data.forEach(item => {
    if (item.categories) {
      const catId = item.category_id;
      if (categoryCountMap.has(catId)) {
        categoryCountMap.get(catId)!.count++;
      } else {
        categoryCountMap.set(catId, { category: item.categories, count: 1 });
      }
    }
  });

  return Array.from(categoryCountMap.values())
    .map(({ category, count }) => ({
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        icon: category.icon,
        pluralName: category.plural_name,
        active: category.active,
      },
      count,
    }))
    .sort((a, b) => a.category.name.localeCompare(b.category.name));
}