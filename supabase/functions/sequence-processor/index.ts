import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const UNSUBSCRIBE_FOOTER = `

--
To stop receiving emails from Top10Lists.us: {{unsubscribe_url}}`;

async function sendEmail(fromAccount: string, to: string, subject: string, body: string, professionalId?: string) {
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/gmail-send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
    },
    body: JSON.stringify({ from_account: fromAccount, to, subject, message_body: body, contact_id: professionalId })
  });
  return res.ok;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

serve(async (req) => {
  try {
    const now = new Date().toISOString();

    const { data: enrollments, error } = await supabase
      .from("crm_sequence_enrollments")
      .select(`
        id, sequence_id, professional_id, email, first_name,
        current_step, metadata, assigned_account,
        crm_sequences!inner(
          id, from_account, on_reply_sequence_id,
          crm_sequence_steps(id, step_number, delay_days, subject, body)
        )
      `)
      .eq("status", "active")
      .lte("next_send_at", now)
      .limit(100);

    if (error) throw error;
    if (!enrollments?.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0, message: "No pending emails" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    let sent = 0, completed = 0, errors = 0;

    for (const enrollment of enrollments) {
      try {
        const seq = enrollment.crm_sequences as any;
        const steps: any[] = seq.crm_sequence_steps.sort((a: any, b: any) => a.step_number - b.step_number);
        const stepIndex = enrollment.current_step;

        if (stepIndex >= steps.length) {
          await supabase.from("crm_sequence_enrollments")
            .update({ status: "completed", completed_at: now })
            .eq("id", enrollment.id);
          completed++;
          continue;
        }

        const step = steps[stepIndex];
        const meta = (enrollment.metadata ?? {}) as Record<string, string>;
        const vars = { firstName: enrollment.first_name ?? "", ...meta };

        const subject = interpolate(step.subject, vars);
        const bodyWithFooter = step.body + UNSUBSCRIBE_FOOTER;
        const body = interpolate(bodyWithFooter, vars);

        // Use assigned account, fall back to sequence default
        const fromAccount = (enrollment.assigned_account as string) ?? seq.from_account;

        const ok = await sendEmail(fromAccount, enrollment.email, subject, body, enrollment.professional_id ?? undefined);

        if (ok) {
          const nextIndex = stepIndex + 1;
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
        console.error("Error on enrollment", enrollment.id, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: enrollments.length, sent, completed, errors }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
