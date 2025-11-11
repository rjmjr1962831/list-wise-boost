import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MarketingContentType = 'text' | 'html' | 'json';

export interface MarketingContent {
  id: string;
  page: string;
  section: string;
  key: string;
  value: string;
  type: MarketingContentType;
  created_at: string;
  updated_at: string;
}

export const useMarketingContent = (page: string = 'main') => {
  return useQuery({
    queryKey: ['marketing-content', page],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_content')
        .select('*')
        .eq('page', page)
        .order('section')
        .order('key');

      if (error) throw error;
      return data as MarketingContent[];
    },
  });
};

export const useMarketingContentValue = (page: string, section: string, key: string, fallback: string = '') => {
  const { data: content } = useMarketingContent(page);
  
  const item = content?.find(
    (c) => c.section === section && c.key === key
  );
  
  return item?.value || fallback;
};
