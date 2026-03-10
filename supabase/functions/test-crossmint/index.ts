// DEPRECATED — This edge function is no longer in active use. See docs/takeaways for context.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CROSSMINT_API_KEY = Deno.env.get("CROSSMINT_API_KEY") || "";

serve(async (req) => {
  try {
    // Test: Mint a badge to robert@top10lists.us
    const response = await fetch("https://www.crossmint.com/api/2022-06-09/collections/default-polygon/nfts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": CROSSMINT_API_KEY
      },
      body: JSON.stringify({
        recipient: "email:robert@top10lists.us:polygon",
        metadata: {
          name: "Top10Lists Verified Agent: Test Badge",
          image: "https://www.top10lists.us/logo.png",
          description: "Merit-based verification badge from Top10Lists.us",
          attributes: [
            { trait_type: "Status", value: "Verified" },
            { trait_type: "Date", value: "2026-02-04" }
          ]
        }
      })
    });

    const data = await response.text();
    
    return new Response(JSON.stringify({
      status: response.status,
      statusText: response.statusText,
      body: data
    }, null, 2), {
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
