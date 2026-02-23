import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function sendEmail(fromAccount: string, to: string, subject: string, body: string, contactId?: string) {
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/gmail-send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
    },
    body: JSON.stringify({ from_account: fromAccount, to, subject, message_body: body, contact_id: contactId })
  });
  return res.ok;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

serve(async (req) => {
  try {
    const now = new Date().toISOString();
    const batchSize = 50;

    // Fetch due enrollments
    const { data: enrollments, error } = await supabase
      .from("crm_sequence_enrollments")
      .select(`
        id, sequence_id, professional_id, email, first_name, current_step, metadata,
        crm_sequences!inner(id, name, from_account, on_reply_sequence_id,
          crm_sequence_steps(id, step_number, delay_days, subject, body)
        )
      `)
      .eq("status", "active")
      .lte("next_send_at", now)
      .limit(batchSize);

    if (error) throw error;
    if (!enrollments?.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0, message: "No pending enrollments" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    let sent = 0, completed = 0, errors = 0;

    for (const enrollment of enrollments) {
      try {
        const seq = enrollment.crm_sequences as any;
        const steps: any[] = seq.crm_sequence_steps.sort((a: any, b: any) => a.step_number - b.step_number);
        const nextStepIndex = enrollment.current_step; // 0-based index into steps array
        
        if (nextStepIndex >= steps.length) {
          // All steps done -- mark complete
          await supabase.from("crm_sequence_enrollments")
            .update({ status: "completed", completed_at: now })
            .eq("id", enrollment.id);
          completed++;
          continue;
        }

        const step = steps[nextStepIndex];
        const meta = enrollment.metadata as Record<string, string>;
        const vars = { firstName: enrollment.first_name ?? "", ...meta };

        const subject = interpolate(step.subject, vars);
        const body = interpolate(step.body, vars);

        const ok = await sendEmail(seq.from_account, enrollment.email, subject, body, enrollment.professional_id);

        if (ok) {
          const nextIndex = nextStepIndex + 1;
          const nextStep = steps[nextIndex];
          
          if (nextStep) {
            const nextSend = new Date();
            nextSend.setDate(nextSend.getDate() + nextStep.delay_days);
            await supabase.from("crm_sequence_enrollments")
              .update({ current_step: nextIndex, next_send_at: nextSend.toISOString() })
              .eq("id", enrollment.id);
          } else {
            await supabase.from("crm_sequence_enrollments")
              .update({ status: "completed", completed_at: now })
              .eq("id", enrollment.id);
            completed++;
          }
          sent++;
        } else {
          errors++;
        }
      } catch (e) {
        errors++;
        console.error("Error processing enrollment", enrollment.id, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: enrollments.length, sent, completed, errors }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
