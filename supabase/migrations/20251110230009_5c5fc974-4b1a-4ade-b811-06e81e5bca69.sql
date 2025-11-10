-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');

-- Create user_roles table for role-based access control
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policy: Admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Create cities table
CREATE TABLE public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  state_slug TEXT NOT NULL,
  slug TEXT NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(state_slug, slug)
);

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

-- Anyone can view active cities
CREATE POLICY "Anyone can view active cities"
ON public.cities
FOR SELECT
USING (active = true);

-- Admins can do everything with cities
CREATE POLICY "Admins can manage cities"
ON public.cities
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  plural_name TEXT NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Anyone can view active categories
CREATE POLICY "Anyone can view active categories"
ON public.categories
FOR SELECT
USING (active = true);

-- Admins can manage categories
CREATE POLICY "Admins can manage categories"
ON public.categories
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create professionals table
CREATE TABLE public.professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES public.cities(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  title TEXT,
  image_url TEXT,
  years_experience INTEGER,
  specialty TEXT[],
  phone TEXT,
  email TEXT,
  website TEXT,
  description TEXT,
  badges TEXT[],
  rank INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('established', 'emerging')),
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

-- Anyone can view active professionals
CREATE POLICY "Anyone can view active professionals"
ON public.professionals
FOR SELECT
USING (active = true);

-- Admins can manage professionals
CREATE POLICY "Admins can manage professionals"
ON public.professionals
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create indexes for better performance
CREATE INDEX idx_professionals_city_id ON public.professionals(city_id);
CREATE INDEX idx_professionals_category_id ON public.professionals(category_id);
CREATE INDEX idx_professionals_type ON public.professionals(type);
CREATE INDEX idx_professionals_rank ON public.professionals(rank);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_cms_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER update_cities_updated_at
BEFORE UPDATE ON public.cities
FOR EACH ROW
EXECUTE FUNCTION public.update_cms_updated_at();

CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.update_cms_updated_at();

CREATE TRIGGER update_professionals_updated_at
BEFORE UPDATE ON public.professionals
FOR EACH ROW
EXECUTE FUNCTION public.update_cms_updated_at();