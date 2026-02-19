/**
 * Script to add proper paragraph formatting to all agent synthesized_bio fields
 * Run with: npx tsx scripts/format-agent-bios.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpb3Rydm9pcmRnemZhY3V1aWVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MTcwNzcsImV4cCI6MjA4NTM5MzA3N30.BZAli-r81llqnq9xStghKNqK8MnrSNQMOIqkkE09mwI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface Professional {
  id: string;
  name: string;
  synthesized_bio: string | null;
}

/**
 * Split text into sentences
 */
function splitIntoSentences(text: string): string[] {
  // Split on periods, exclamation marks, and question marks followed by space or end of string
  // but avoid splitting on common abbreviations
  const sentences = text
    .replace(/([.!?])\s+/g, '$1|SPLIT|')
    .split('|SPLIT|')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  return sentences;
}

/**
 * Intelligently group sentences into paragraphs
 * Logic:
 * 1. First 1-2 sentences: Track record and credentials (intro paragraph)
 * 2. Next 3-5 sentences: Experience, specialties, approach (main paragraph)
 * 3. Remaining sentences: Community involvement, awards, charity (final paragraph)
 */
function addParagraphBreaks(text: string): string {
  // If already has <p> tags, return as-is
  if (text.includes('<p>')) {
    console.log('  Already has paragraph tags, skipping...');
    return text;
  }

  // Remove any existing HTML tags except <br>
  const cleanText = text.replace(/<(?!br\s*\/?)[^>]+>/g, '');

  const sentences = splitIntoSentences(cleanText);
  
  if (sentences.length === 0) {
    return text;
  }

  // If only 1-2 sentences, just wrap in single paragraph
  if (sentences.length <= 2) {
    return `<p>${sentences.join(' ')}</p>`;
  }

  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];
  
  // Keywords to identify different sections
  const introKeywords = ['years', 'experience', 'completing', 'transactions', 'rating', 'reviews', 'since', 'founded'];
  const expertiseKeywords = ['specialize', 'expertise', 'approach', 'methodology', 'team', 'brings', 'coordinates', 'innovative', 'client'];
  const communityKeywords = ['serve', 'member', 'committee', 'nonprofit', 'charity', 'volunteer', 'community', 'organize', 'food drive', 'founded'];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const lowerSentence = sentence.toLowerCase();
    
    currentParagraph.push(sentence);

    // Determine if we should break here
    let shouldBreak = false;

    // First paragraph: credentials and track record (1-2 sentences)
    if (i === 0 || i === 1) {
      const hasIntroKeywords = introKeywords.some(kw => lowerSentence.includes(kw));
      const nextHasExpertise = i + 1 < sentences.length && 
        expertiseKeywords.some(kw => sentences[i + 1].toLowerCase().includes(kw));
      
      if (hasIntroKeywords && nextHasExpertise && i >= 0) {
        shouldBreak = true;
      }
    }
    // Middle paragraphs: expertise and approach (look for topic shift to community)
    else if (i > 1 && i < sentences.length - 1) {
      const hasCommunityKeywords = communityKeywords.some(kw => lowerSentence.includes(kw));
      const nextHasCommunity = i + 1 < sentences.length && 
        communityKeywords.some(kw => sentences[i + 1].toLowerCase().includes(kw));
      
      // Break before community involvement section starts
      if (nextHasCommunity && !hasCommunityKeywords) {
        shouldBreak = true;
      }
      // Or if current paragraph is getting too long (5+ sentences)
      else if (currentParagraph.length >= 5) {
        shouldBreak = true;
      }
    }

    if (shouldBreak && currentParagraph.length > 0) {
      paragraphs.push(`<p>${currentParagraph.join(' ')}</p>`);
      currentParagraph = [];
    }
  }

  // Add remaining sentences as final paragraph
  if (currentParagraph.length > 0) {
    paragraphs.push(`<p>${currentParagraph.join(' ')}</p>`);
  }

  return paragraphs.join('\n\n');
}

/**
 * Fetch all professionals with synthesized_bio
 */
async function fetchAllProfessionals(): Promise<Professional[]> {
  const allProfessionals: Professional[] = [];
  const pageSize = 1000;
  let offset = 0;
  
  console.log('Fetching all professionals with synthesized_bio...');
  
  while (true) {
    const { data, error } = await supabase
      .from('professionals')
      .select('id, name, synthesized_bio')
      .not('synthesized_bio', 'is', null)
      .range(offset, offset + pageSize - 1);
    
    if (error) {
      console.error('Error fetching professionals:', error);
      break;
    }
    
    if (!data || data.length === 0) {
      break;
    }
    
    allProfessionals.push(...data);
    console.log(`  Fetched ${allProfessionals.length} professionals...`);
    
    if (data.length < pageSize) {
      break;
    }
    
    offset += pageSize;
  }
  
  console.log(`\nTotal professionals with bios: ${allProfessionals.length}\n`);
  return allProfessionals;
}

/**
 * Update a single professional's bio
 */
async function updateProfessionalBio(id: string, formattedBio: string): Promise<boolean> {
  const { error } = await supabase
    .from('professionals')
    .update({ synthesized_bio: formattedBio })
    .eq('id', id);
  
  if (error) {
    console.error(`Error updating professional ${id}:`, error);
    return false;
  }
  
  return true;
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(60));
  console.log('AGENT BIO PARAGRAPH FORMATTER');
  console.log('='.repeat(60));
  console.log();

  // Fetch all professionals
  const professionals = await fetchAllProfessionals();
  
  if (professionals.length === 0) {
    console.log('No professionals found with synthesized_bio. Exiting.');
    return;
  }

  console.log('Processing and updating bios...\n');
  
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const prof of professionals) {
    console.log(`Processing: ${prof.name} (${prof.id})`);
    
    if (!prof.synthesized_bio) {
      console.log('  No bio found, skipping...\n');
      skipped++;
      continue;
    }

    try {
      const formattedBio = addParagraphBreaks(prof.synthesized_bio);
      
      // Only update if the bio actually changed
      if (formattedBio === prof.synthesized_bio) {
        console.log('  No changes needed, skipping...\n');
        skipped++;
        continue;
      }

      console.log(`  Original length: ${prof.synthesized_bio.length} chars`);
      console.log(`  Formatted length: ${formattedBio.length} chars`);
      
      const success = await updateProfessionalBio(prof.id, formattedBio);
      
      if (success) {
        console.log('  ✓ Updated successfully\n');
        updated++;
      } else {
        console.log('  ✗ Update failed\n');
        errors++;
      }
    } catch (err) {
      console.error(`  ✗ Error processing bio: ${err}\n`);
      errors++;
    }
  }

  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total processed: ${professionals.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log('='.repeat(60));
}

// Run the script
main().catch(console.error);
