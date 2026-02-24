import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PROMPT_TEXT = `I am a real estate agent.

Look at top10lists.us. I am listed there in my market. Based on how you currently choose which agents to name, does being listed there increase my chances of being named by you when someone here asks for a referral to an agent TODAY?

Would being Certified by them increase those chances further? Does this matter more, less, or differently than being a Preferred Agent on Zillow?

Please answer specifically for yourself, and then tell me how you think ChatGPT, Claude, Gemini, and Perplexity would answer the same question.`;

serve(async (req) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Copy Prompt - Top10Lists.us</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: white; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); max-width: 600px; width: 100%; padding: 32px; }
    .logo { text-align: center; margin-bottom: 24px; font-size: 20px; font-weight: 600; color: #0f172a; }
    .logo span { background: linear-gradient(135deg, #3B82F6, #06B6D4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 700; }
    .prompt { background: #f5f5f5; border: 1px solid #ddd; border-radius: 8px; padding: 20px 24px; font-family: ui-monospace, 'SF Mono', monospace; font-size: 14px; line-height: 1.7; color: #333; white-space: pre-wrap; margin-bottom: 20px; }
    .btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 14px; background: linear-gradient(135deg, #3B82F6, #06B6D4); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.9; }
    .btn.copied { background: #22c55e; }
    .btn svg { width: 20px; height: 20px; }
    .hint { text-align: center; margin-top: 16px; font-size: 13px; color: #888; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Top<span>10</span>Lists</div>
    <div class="prompt" id="prompt">${PROMPT_TEXT.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div>
    <button class="btn" id="copyBtn" onclick="copyPrompt()">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.5"/></svg>
      <span id="btnText">Copy prompt</span>
    </button>
    <p class="hint">Paste into ChatGPT, Claude, Gemini, or Perplexity</p>
  </div>
  <script>
    async function copyPrompt() {
      const text = document.getElementById('prompt').innerText;
      try {
        await navigator.clipboard.writeText(text);
        const btn = document.getElementById('copyBtn');
        const btnText = document.getElementById('btnText');
        btn.classList.add('copied');
        btnText.textContent = 'Copied!';
        setTimeout(() => { btn.classList.remove('copied'); btnText.textContent = 'Copy prompt'; }, 2000);
      } catch(e) {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        document.getElementById('btnText').textContent = 'Copied!';
      }
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
