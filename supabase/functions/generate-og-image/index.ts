import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get professional ID from query params
    const url = new URL(req.url);
    const professionalId = url.searchParams.get('id');

    if (!professionalId) {
      return new Response(JSON.stringify({ error: 'Professional ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch professional data
    const { data: professional, error } = await supabase
      .from('professionals')
      .select(`
        *,
        cities(name, state),
        categories(name)
      `)
      .eq('id', professionalId)
      .single();

    if (error || !professional) {
      console.error('Error fetching professional:', error);
      return new Response(JSON.stringify({ error: 'Professional not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate OG image using Canvas API (HTML Canvas in Deno)
    const width = 1200;
    const height = 630;
    
    // Strip HTML from bio
    const stripHtml = (html: string): string => {
      if (!html) return '';
      return html.replace(/<[^>]*>/g, '');
    };

    // Get bio text
    const bioText = stripHtml(professional.get_to_know_me || professional.description || '');
    const truncatedBio = bioText.length > 300 ? bioText.substring(0, 297) + '...' : bioText;

    // Get rating
    const rating = professional.review_stars_rating || 5.0;
    const reviewCount = professional.num_total_reviews || 0;

    // Get stats
    const agentStats = professional.agent_sales_stats as any;
    const totalSales = professional.total_sales || agentStats?.countAllTime || 0;
    const yearsExp = professional.years_experience || 0;

    // Get specialties
    const specialties = (professional.specialty || []).slice(0, 3);

    // Get location
    const cityName = (professional.cities as any)?.name || '';
    const stateName = (professional.cities as any)?.state || '';
    const location = `${cityName}, ${stateName}`;

    // Generate SVG
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:hsl(234, 45%, 21%);stop-opacity:0.03" />
            <stop offset="100%" style="stop-color:hsl(186, 100%, 50%);stop-opacity:0.06" />
          </linearGradient>
        </defs>
        
        <!-- Background -->
        <rect width="${width}" height="${height}" fill="white"/>
        <rect width="${width}" height="${height}" fill="url(#bgGradient)"/>
        
        <!-- Left accent border -->
        <rect x="0" y="0" width="8" height="${height}" fill="hsl(234, 45%, 21%)"/>
        
        <!-- Photo placeholder (circle) -->
        <circle cx="140" cy="140" r="80" fill="hsl(234, 45%, 21%)" opacity="0.1"/>
        <circle cx="140" cy="140" r="75" fill="hsl(0, 0%, 90%)"/>
        
        <!-- TOP10LISTS.US branding -->
        <text x="50" y="50" font-family="Inter, sans-serif" font-size="18" font-weight="700" fill="hsl(234, 45%, 21%)">
          TOP10LISTS.US
        </text>
        
        <!-- Name -->
        <text x="260" y="110" font-family="Playfair Display, serif" font-size="42" font-weight="700" fill="hsl(234, 45%, 21%)">
          ${professional.name.substring(0, 30)}
        </text>
        
        <!-- Category/Company -->
        <text x="260" y="150" font-family="Inter, sans-serif" font-size="22" fill="hsl(0, 0%, 45%)">
          ${(professional.categories as any)?.name || 'Real Estate Agent'}
        </text>
        <text x="260" y="180" font-family="Inter, sans-serif" font-size="20" fill="hsl(0, 0%, 50%)">
          ${(professional.company || '').substring(0, 35)}
        </text>
        
        <!-- Location -->
        <text x="260" y="210" font-family="Inter, sans-serif" font-size="18" fill="hsl(0, 0%, 55%)">
          📍 ${location}
        </text>
        
        <!-- Rating stars -->
        <text x="50" y="280" font-family="Inter, sans-serif" font-size="24" font-weight="600" fill="hsl(25, 95%, 60%)">
          ${'★'.repeat(Math.floor(rating))}${'☆'.repeat(5 - Math.floor(rating))} ${rating.toFixed(1)}
        </text>
        <text x="260" y="280" font-family="Inter, sans-serif" font-size="18" fill="hsl(0, 0%, 50%)">
          ${reviewCount} reviews
        </text>
        
        <!-- Stats -->
        ${yearsExp > 0 ? `
        <text x="420" y="280" font-family="Inter, sans-serif" font-size="18" fill="hsl(0, 0%, 50%)">
          • ${yearsExp} Years
        </text>
        ` : ''}
        ${totalSales > 0 ? `
        <text x="560" y="280" font-family="Inter, sans-serif" font-size="18" fill="hsl(0, 0%, 50%)">
          • ${totalSales}+ Sales
        </text>
        ` : ''}
        
        <!-- Specialties -->
        ${specialties.map((spec: string, idx: number) => `
          <rect x="${50 + (idx * 180)}" y="310" width="${Math.min(spec.length * 9 + 30, 170)}" height="36" rx="18" fill="hsl(186, 100%, 50%)" opacity="0.15"/>
          <text x="${65 + (idx * 180)}" y="333" font-family="Inter, sans-serif" font-size="14" font-weight="500" fill="hsl(234, 45%, 21%)">
            ${spec.substring(0, 18)}
          </text>
        `).join('')}
        
        <!-- Bio (line-wrapped) -->
        ${wrapText(truncatedBio, 50, 380, 1100, 20, 28).map(line => 
          `<text x="50" y="${line.y}" font-family="Inter, sans-serif" font-size="18" fill="hsl(0, 0%, 35%)">${line.text}</text>`
        ).join('')}
        
        <!-- Verified badge (if applicable) -->
        ${professional.license_verified_at ? `
          <rect x="1000" y="40" width="150" height="32" rx="16" fill="hsl(186, 100%, 50%)"/>
          <text x="1025" y="62" font-family="Inter, sans-serif" font-size="14" font-weight="600" fill="white">
            ✓ Verified
          </text>
        ` : ''}
      </svg>
    `;

    // Helper function to wrap text
    function wrapText(text: string, x: number, y: number, maxWidth: number, fontSize: number, lineHeight: number) {
      const words = text.split(' ');
      const lines: { text: string; y: number }[] = [];
      let currentLine = '';
      let currentY = y;
      const maxLines = 5; // Limit to 5 lines
      
      for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const approximateWidth = testLine.length * (fontSize * 0.55); // Rough approximation
        
        if (approximateWidth > maxWidth && currentLine) {
          lines.push({ text: currentLine, y: currentY });
          currentLine = word;
          currentY += lineHeight;
          
          if (lines.length >= maxLines) break;
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine && lines.length < maxLines) {
        lines.push({ text: currentLine, y: currentY });
      }
      
      return lines;
    }

    // Return SVG as PNG (browsers will render SVG)
    return new Response(svg, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error generating OG image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
