import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResyncResult {
  id: string;
  name: string;
  success: boolean;
  error?: string;
  before?: {
    length: number;
    paragraphs: number;
    hasHtml: boolean;
  };
  after?: {
    length: number;
    paragraphs: number;
    hasHtml: boolean;
  };
}

function countParagraphs(bio: string | null): number {
  if (!bio) return 0;
  // Strip HTML and count by double newlines or <p> tags
  const stripped = bio.replace(/<\/?p>/g, '\n\n').replace(/<[^>]+>/g, '');
  const paragraphs = stripped.split(/\n\n+/).filter(p => p.trim().length > 0);
  return paragraphs.length;
}

function hasHtmlTags(bio: string | null): boolean {
  if (!bio) return false;
  return /<[^>]+>/.test(bio);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { professional_ids, dry_run = false } = await req.json();

    if (!professional_ids || !Array.isArray(professional_ids) || professional_ids.length === 0) {
      throw new Error('professional_ids array is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`\n🔄 Resync Long Bios - ${dry_run ? 'DRY RUN' : 'LIVE RUN'}`);
    console.log(`   Processing ${professional_ids.length} professionals`);

    const results: ResyncResult[] = [];

    for (const professionalId of professional_ids) {
      console.log(`\n📝 Processing: ${professionalId}`);

      // Fetch current bio
      const { data: professional, error: fetchError } = await supabase
        .from('professionals')
        .select('id, name, synthesized_bio')
        .eq('id', professionalId)
        .single();

      if (fetchError || !professional) {
        console.log(`   ❌ Not found: ${professionalId}`);
        results.push({
          id: professionalId,
          name: 'Unknown',
          success: false,
          error: fetchError?.message || 'Not found'
        });
        continue;
      }

      const beforeStats = {
        length: professional.synthesized_bio?.length || 0,
        paragraphs: countParagraphs(professional.synthesized_bio),
        hasHtml: hasHtmlTags(professional.synthesized_bio)
      };

      console.log(`   📊 Before: ${beforeStats.length} chars, ${beforeStats.paragraphs} paragraphs, HTML: ${beforeStats.hasHtml}`);

      if (dry_run) {
        // In dry run, just show what would happen
        results.push({
          id: professionalId,
          name: professional.name,
          success: true,
          before: beforeStats,
          after: undefined // Would be populated after actual synthesis
        });
        console.log(`   🔍 DRY RUN - Would re-synthesize ${professional.name}`);
        continue;
      }

      // Call synthesize-agent-profile
      try {
        const synthResponse = await fetch(`${supabaseUrl}/functions/v1/synthesize-agent-profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({ professionalId })
        });

        if (!synthResponse.ok) {
          const errorText = await synthResponse.text();
          throw new Error(`Synthesis failed: ${synthResponse.status} - ${errorText}`);
        }

        const synthResult = await synthResponse.json();
        
        if (!synthResult.success) {
          throw new Error(synthResult.error || 'Synthesis returned failure');
        }

        // Fetch updated bio
        const { data: updated, error: updateFetchError } = await supabase
          .from('professionals')
          .select('synthesized_bio')
          .eq('id', professionalId)
          .single();

        const afterStats = {
          length: updated?.synthesized_bio?.length || 0,
          paragraphs: countParagraphs(updated?.synthesized_bio),
          hasHtml: hasHtmlTags(updated?.synthesized_bio)
        };

        console.log(`   ✅ After: ${afterStats.length} chars, ${afterStats.paragraphs} paragraphs, HTML: ${afterStats.hasHtml}`);

        results.push({
          id: professionalId,
          name: professional.name,
          success: true,
          before: beforeStats,
          after: afterStats
        });

      } catch (synthError) {
        console.log(`   ❌ Synthesis error: ${synthError instanceof Error ? synthError.message : 'Unknown'}`);
        results.push({
          id: professionalId,
          name: professional.name,
          success: false,
          error: synthError instanceof Error ? synthError.message : 'Unknown error',
          before: beforeStats
        });
      }
    }

    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`\n📊 Summary:`);
    console.log(`   Total: ${results.length}`);
    console.log(`   Successful: ${successful}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Mode: ${dry_run ? 'DRY RUN' : 'LIVE'}`);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        summary: {
          total: results.length,
          successful,
          failed
        },
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in resync-long-bios:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
