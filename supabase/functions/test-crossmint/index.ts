import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CROSSMINT_API_KEY = "sk_production_6BGbDw5YKeSjs38vbHx6gzZHkNhxFLrBvZJXEkw32kbHhN6Bcp4EyPcYgW67zsTb71WdQc5QtzPXteDkD1gHvYKxsC1gfSkSD5rG5a3uepysgkYL2xuuN29FGB5pkmsTa1gcwUofpKonArVfmG92A1TbWjx7Rk6vFSoxALBAC3zv1acmMeQD6gLFS2k63yPF63LeaPHCnBBQMWQUk1yc9kx5";

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
