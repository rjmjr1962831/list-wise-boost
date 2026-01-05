import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SERVICE_TIER_LABELS: Record<string, string> = {
  tier1: "Tier 1: Protocol Implementation ($2,500)",
  tier2: "Tier 2: Full GEO Optimization ($5,000)",
  tier3: "Tier 3: Managed GEO Service ($500/month)",
  consultation: "Consultation / Not Sure"
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      organization_name,
      website_url,
      contact_name,
      email,
      phone,
      service_tier,
      industry,
      project_description
    } = await req.json();

    console.log("Processing service inquiry for:", organization_name);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      throw new Error("Email service not configured");
    }

    const serviceTierLabel = SERVICE_TIER_LABELS[service_tier] || service_tier;

    // Send notification to admin
    const adminEmailHtml = `
      <h2>New Protocol Services Quote Request</h2>
      <p><strong>Organization:</strong> ${organization_name}</p>
      <p><strong>Website:</strong> <a href="${website_url}">${website_url}</a></p>
      <p><strong>Contact:</strong> ${contact_name}</p>
      <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
      <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
      <p><strong>Service Interest:</strong> ${serviceTierLabel}</p>
      <p><strong>Industry:</strong> ${industry}</p>
      ${project_description ? `<p><strong>Project Description:</strong></p><p>${project_description}</p>` : ""}
      <hr />
      <p style="color: #666; font-size: 12px;">Submitted via Top10Lists.us Protocol Services page</p>
    `;

    const adminResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Top10Lists <notifications@top10lists.us>",
        to: ["hello@top10lists.us"],
        subject: `Protocol Services Request: ${organization_name} - ${serviceTierLabel}`,
        html: adminEmailHtml,
        reply_to: email
      }),
    });

    if (!adminResponse.ok) {
      const errorText = await adminResponse.text();
      console.error("Failed to send admin notification:", errorText);
    } else {
      console.log("Admin notification sent successfully");
    }

    // Send confirmation to requester
    const confirmationHtml = `
      <h2>Thank you for your interest in Protocol Services</h2>
      <p>Hi ${contact_name},</p>
      <p>We've received your quote request for <strong>${serviceTierLabel}</strong>.</p>
      <p>Our team will review your information and get back to you within 1 business day.</p>
      <h3>Your Request Summary:</h3>
      <ul>
        <li><strong>Organization:</strong> ${organization_name}</li>
        <li><strong>Website:</strong> ${website_url}</li>
        <li><strong>Service:</strong> ${serviceTierLabel}</li>
        <li><strong>Industry:</strong> ${industry}</li>
      </ul>
      ${project_description ? `<p><strong>Project Notes:</strong> ${project_description}</p>` : ""}
      <p>In the meantime, you can review our <a href="https://www.top10lists.us/protocol-adopters">free AI Citation Protocol</a>.</p>
      <p>Best regards,<br />The Top10Lists.us Team</p>
    `;

    const confirmResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Top10Lists <hello@top10lists.us>",
        to: [email],
        subject: "We received your Protocol Services request",
        html: confirmationHtml,
      }),
    });

    if (!confirmResponse.ok) {
      const errorText = await confirmResponse.text();
      console.error("Failed to send confirmation email:", errorText);
    } else {
      console.log("Confirmation email sent to:", email);
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-protocol-service-inquiry-email:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});