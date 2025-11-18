import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as cheerio from "https://esm.sh/cheerio@1.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ZillowAgentData {
  name: string | null;
  company: string | null;
  profileUrl: string;
  imageUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  totalSales: number | null;
  currentListings: number | null;
  yearsExperience: number | null;
  priceRange: string | null;
  specialties: string[];
  phoneNumber: string | null;
  email: string | null;
  licenseNumber: string | null;
  bio: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileUrl } = await req.json();
    
    if (!profileUrl) {
      throw new Error('Profile URL is required');
    }

    console.log(`Parsing Zillow agent profile: ${profileUrl}`);

    // Fetch the HTML content
    const response = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract agent data using Zillow-specific selectors
    const agentData: ZillowAgentData = {
      profileUrl,
      name: null,
      company: null,
      imageUrl: null,
      rating: null,
      reviewCount: null,
      totalSales: null,
      currentListings: null,
      yearsExperience: null,
      priceRange: null,
      specialties: [],
      phoneNumber: null,
      email: null,
      licenseNumber: null,
      bio: null,
    };

    // Agent name - multiple possible selectors
    agentData.name = 
      $('h1[data-testid="agent-name"]').first().text().trim() ||
      $('h1.agent-name').first().text().trim() ||
      $('.profile-header h1').first().text().trim() ||
      $('meta[property="og:title"]').attr('content')?.trim() ||
      null;

    // Company/Brokerage
    agentData.company = 
      $('[data-testid="agent-company"]').first().text().trim() ||
      $('.agent-company').first().text().trim() ||
      $('.brokerage-name').first().text().trim() ||
      null;

    // Profile image
    agentData.imageUrl = 
      $('img[data-testid="agent-photo"]').attr('src') ||
      $('img.agent-photo').attr('src') ||
      $('.profile-photo img').attr('src') ||
      $('meta[property="og:image"]').attr('content') ||
      null;

    // Rating
    const ratingText = 
      $('[data-testid="agent-rating"]').first().text().trim() ||
      $('.rating-value').first().text().trim() ||
      '';
    agentData.rating = ratingText ? parseFloat(ratingText) : null;

    // Review count
    const reviewText = 
      $('[data-testid="review-count"]').first().text().trim() ||
      $('.review-count').first().text().trim() ||
      '';
    const reviewMatch = reviewText.match(/(\d+)\s*reviews?/i);
    agentData.reviewCount = reviewMatch ? parseInt(reviewMatch[1]) : null;

    // Sales data - multiple patterns
    $('[data-testid*="sales"], .sales-stat, .transaction-stat').each((_, el) => {
      const text = $(el).text().trim();
      
      // Total sales pattern
      if (/sold|transactions?|deals?/i.test(text)) {
        const match = text.match(/(\d+)\s*(?:sold|transactions?|deals?)/i);
        if (match && !agentData.totalSales) {
          agentData.totalSales = parseInt(match[1]);
        }
      }
      
      // Current listings pattern
      if (/listings?|active|for sale/i.test(text)) {
        const match = text.match(/(\d+)\s*(?:listings?|active|for sale)/i);
        if (match && !agentData.currentListings) {
          agentData.currentListings = parseInt(match[1]);
        }
      }
    });

    // Years of experience
    const experienceText = 
      $('[data-testid*="experience"]').first().text().trim() ||
      $('.experience').first().text().trim() ||
      '';
    const expMatch = experienceText.match(/(\d+)\s*years?/i);
    agentData.yearsExperience = expMatch ? parseInt(expMatch[1]) : null;

    // Price range
    agentData.priceRange = 
      $('[data-testid*="price-range"]').first().text().trim() ||
      $('.price-range').first().text().trim() ||
      null;

    // Specialties/Areas of expertise
    $('[data-testid*="specialty"], .specialty, .expertise-tag, .specialization').each((_, el) => {
      const specialty = $(el).text().trim();
      if (specialty && !agentData.specialties.includes(specialty)) {
        agentData.specialties.push(specialty);
      }
    });

    // Phone number
    agentData.phoneNumber = 
      $('[data-testid*="phone"]').first().text().trim() ||
      $('a[href^="tel:"]').first().text().trim() ||
      null;

    // Email
    agentData.email = 
      $('[data-testid*="email"]').first().text().trim() ||
      $('a[href^="mailto:"]').attr('href')?.replace('mailto:', '') ||
      null;

    // License number
    const licenseText = $('body').text();
    const licenseMatch = licenseText.match(/license\s*(?:number|#)?\s*:?\s*([A-Z0-9-]+)/i);
    agentData.licenseNumber = licenseMatch ? licenseMatch[1] : null;

    // Bio/Description
    agentData.bio = 
      $('[data-testid*="bio"]').first().text().trim() ||
      $('.agent-bio').first().text().trim() ||
      $('.profile-description').first().text().trim() ||
      $('meta[name="description"]').attr('content')?.trim() ||
      null;

    // Extract ZUID from URL if possible
    const zuidMatch = profileUrl.match(/zillow\.com\/profile\/([^\/\?]+)/);
    const zuid = zuidMatch ? zuidMatch[1] : null;

    console.log('Parsed agent data:', JSON.stringify(agentData, null, 2));

    return new Response(
      JSON.stringify({ 
        success: true,
        agent: agentData,
        zuid,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in parse-zillow-agent:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
