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
        
        <!-- TOP10LISTS.US branding -->
        <text x="30" y="45" font-family="Inter, sans-serif" font-size="20" font-weight="700" fill="hsl(234, 45%, 21%)">
          TOP10LISTS.US
        </text>
        
        <!-- Confirm or Edit button - centered in right space -->
        <rect x="${width - 400}" y="${(height / 2) - 45}" width="340" height="90" rx="45" fill="hsl(176, 100%, 50%)"/>
        <text x="${width - 230}" y="${(height / 2) + 10}" font-family="Inter, sans-serif" font-size="28" font-weight="700" fill="hsl(234, 45%, 21%)" text-anchor="middle">
          Confirm or Edit
        </text>
        
        <!-- Photo - left side, not overlapping -->
        <defs>
          <clipPath id="photoClip">
            <circle cx="110" cy="160" r="70"/>
          </clipPath>
        </defs>
        ${professional.image_url ? `
          <image href="${professional.image_url}" x="40" y="90" width="140" height="140" clip-path="url(#photoClip)" preserveAspectRatio="xMidYMid slice"/>
        ` : `
          <circle cx="110" cy="160" r="70" fill="hsl(234, 45%, 21%)" opacity="0.1"/>
          <circle cx="110" cy="160" r="65" fill="hsl(0, 0%, 90%)"/>
        `}
        
        <!-- Name - right of photo -->
        <text x="220" y="130" font-family="Playfair Display, serif" font-size="44" font-weight="700" fill="hsl(234, 45%, 21%)">
          ${professional.name.substring(0, 28)}
        </text>
        
        <!-- Title and Company -->
        <text x="220" y="170" font-family="Inter, sans-serif" font-size="20" fill="hsl(234, 45%, 41%)">
          ${(professional.categories as any)?.name || 'Real Estate Agent'}
        </text>
        <text x="220" y="200" font-family="Inter, sans-serif" font-size="18" fill="hsl(234, 45%, 51%)">
          ${(professional.company || '').substring(0, 45)}
        </text>
        <text x="220" y="225" font-family="Inter, sans-serif" font-size="17" fill="hsl(234, 45%, 61%)">
          ${location}
        </text>
        ${professional.license_number ? `
          <text x="220" y="250" font-family="Inter, sans-serif" font-size="16" fill="hsl(234, 45%, 51%)">
            License: ${professional.license_number}
          </text>
        ` : ''}
        
        <!-- Rating and Stats - single line -->
        <text x="30" y="280" font-family="Inter, sans-serif" font-size="26" font-weight="700" fill="hsl(27, 87%, 57%)">
          ⭐ ${rating.toFixed(1)}
        </text>
        <text x="150" y="280" font-family="Inter, sans-serif" font-size="19" fill="hsl(234, 45%, 41%)">
          ${reviewCount} reviews
        </text>
        ${yearsExp > 0 ? `
          <text x="330" y="280" font-family="Inter, sans-serif" font-size="19" fill="hsl(234, 45%, 41%)">
            • ${yearsExp} Years
          </text>
        ` : ''}
        ${totalSales > 0 ? `
          <text x="480" y="280" font-family="Inter, sans-serif" font-size="19" fill="hsl(234, 45%, 41%)">
            • ${totalSales}+ Sales
          </text>
        ` : ''}
        
        <!-- Contact Info - Single Line -->
        <text x="30" y="335" font-family="Inter, sans-serif" font-size="16" fill="hsl(234, 45%, 51%)">
          ${(professional.website || 'No website').replace('https://', '').replace('http://', '').substring(0, 35)} • ${professional.email || 'No email'} • ${professional.phone || 'No phone'}
        </text>
        
        <!-- Video URL -->
        ${professional.sidebar_video_url ? `
          <text x="30" y="370" font-family="Inter, sans-serif" font-size="17" font-weight="600" fill="hsl(176, 100%, 35%)">
            📹 Video available at profile
          </text>
        ` : `
          <text x="30" y="370" font-family="Inter, sans-serif" font-size="17" fill="hsl(0, 0%, 55%)">
            No video found
          </text>
        `}
        
        <!-- Specialties -->
        ${specialties.length > 0 ? `
          <text x="30" y="420" font-family="Inter, sans-serif" font-size="18" font-weight="600" fill="hsl(234, 45%, 41%)">
            ${specialties.slice(0, 3).join(' • ')}
          </text>
        ` : ''}
        
        <!-- Bio (line-wrapped) -->
        ${wrapText(truncatedBio, 30, 465, 1140, 18, 26).map(line => 
          `<text x="30" y="${line.y}" font-family="Inter, sans-serif" font-size="17" fill="hsl(0, 0%, 35%)">${line.text}</text>`
        ).join('')}
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
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
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
