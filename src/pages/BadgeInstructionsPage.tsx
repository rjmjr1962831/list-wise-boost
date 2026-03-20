/**
 * Human-readable badge instructions: download badge, use on website, Zillow, email, social.
 * Access via ?token= (from email) or from dashboard. One link—badge updates when tier changes.
 */
import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { SafeHead } from "@/components/SafeHead";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check, Download, Globe, Mail, Building2, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const BASE = "https://www.top10lists.us";

interface Pro {
  id: string;
  short_code: string | null;
  name: string | null;
  verification_token: string | null;
  current_tier: string | null;
  website: string | null;
  zillow_profile_url: string | null;
  email: string | null;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`Copied ${label}`);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} className="shrink-0">
      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
      <span className="ml-1.5">{copied ? "Copied" : "Copy"}</span>
    </Button>
  );
}

export default function BadgeInstructionsPage() {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get("token");
  const [pro, setPro] = useState<Pro | null>(null);
  const [loading, setLoading] = useState(true);
  const [otherPlatform, setOtherPlatform] = useState("");
  const [sessionPro, setSessionPro] = useState<Pro | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (tokenParam) {
          const { data: byToken } = await supabase
            .from("professionals")
            .select("id, short_code, name, verification_token, current_tier, website, zillow_profile_url, email")
            .eq("verification_token", tokenParam)
            .maybeSingle();
          if (byToken) {
            setPro(byToken as Pro);
            setLoading(false);
            return;
          }
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tokenParam);
          if (isUuid) {
            const { data: byId } = await supabase
              .from("professionals")
              .select("id, short_code, name, verification_token, current_tier, website, zillow_profile_url, email")
              .eq("id", tokenParam)
              .maybeSingle();
            if (byId) setPro(byId as Pro);
          }
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          const { data: prof } = await supabase
            .from("professionals")
            .select("id, short_code, name, verification_token, current_tier, website, zillow_profile_url, email")
            .eq("email", user.email)
            .maybeSingle();
          if (prof && !pro) setPro(prof as Pro);
          if (prof) setSessionPro(prof as Pro);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [tokenParam]);

  const agent = pro ?? sessionPro;
  const badgeId = agent?.short_code || agent?.id || "";
  const artifactToken = agent?.verification_token || agent?.id || "";
  const badgeSvgUrl = badgeId ? `${BASE}/api/badge/${badgeId}.svg` : "";
  const artifactUrl = artifactToken ? `${BASE}/artifact/${artifactToken}` : "";
  const rawTier = (agent?.current_tier ?? "certified").toLowerCase();
  const isListed = rawTier === "listed";
  const tierName = ((agent?.current_tier ?? "certified").charAt(0).toUpperCase() + (agent?.current_tier ?? "certified").slice(1)).replace(/_/g, " ");
  const orbSnippet = badgeSvgUrl && artifactUrl
    ? `<a href="${artifactUrl}"\n   target="_blank"\n   rel="author"\n   title="Top10Lists.us - Verified AI Artifact">\n   <img src="${badgeSvgUrl}"\n        alt="Top10Lists ${tierName} AI Entity - Cryptographically Verified Data Payload"\n        style="width: 80px; height: 80px; border: none; cursor: pointer;" />\n</a>`
    : "";
  const invisibleSnippet = badgeSvgUrl && artifactUrl
    ? `<a href="${artifactUrl}"\n   target="_blank"\n   rel="author"\n   title="Top10Lists.us - Verified AI Artifact">\n   <img src="${badgeSvgUrl}"\n        alt="Top10Lists ${tierName} AI Entity - Cryptographically Verified Data Payload"\n        style="width: 1px; height: 1px; border: none; opacity: 0; position: absolute;" />\n</a>`
    : "";
  const [snippetMode, setSnippetMode] = useState<"visible" | "invisible">("visible");
  const activeSnippet = snippetMode === "visible" ? orbSnippet : invisibleSnippet;
  const htmlSnippet = orbSnippet;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading your badge details…</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="container max-w-2xl py-12">
        <SafeHead>
          <title>Badge instructions | Top10Lists.us</title>
          <meta name="robots" content="noindex, nofollow" />
        </SafeHead>
        <Card>
          <CardHeader>
            <CardTitle>Badge instructions</CardTitle>
            <CardContent className="pt-0">
              <p className="text-muted-foreground">
                Use the link from your tier-change email, or{" "}
                <Link to="/agent-login" className="text-primary underline">log in to your dashboard</Link> and open
                &quot;Badge &amp; sharing&quot; to see your personal badge link and install instructions.
              </p>
            </CardContent>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8">
      <SafeHead>
        <title>How to use your Top10Lists.us badge | {agent.name ?? "Agent"}</title>
        <meta name="description" content="Download and install your Top10Lists.us certification badge on your website, Zillow, email, and social profiles. One link—updates automatically when your tier changes." />
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1">How to use your Top10Lists.us badge</h1>
        <p className="text-muted-foreground">
          Your badge always shows your current tier. Set it once—when your tier changes (e.g. Certified → Underwritten), the same link updates automatically.
        </p>
      </div>

      {isListed && (
        <Card className="mb-6 border-2 border-amber-500/30">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-lg font-semibold">Web of Truth is available on Certified and above</p>
            <p className="text-sm text-muted-foreground">
              Your Listed tier includes basic verification. Upgrade to Certified (free) or higher to enable your Web of Truth beacon and artifact page.
            </p>
            <Link to={`/funnel/${artifactToken}/pricing`}>
              <Button>View Upgrade Options <ChevronRight className="h-4 w-4 ml-1" /></Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {!isListed && (<>
      {/* === Tier-enabled content below === */}

      {/* 1. Your Web of Truth Beacon */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Enable Your Web of Truth&trade; Beacon
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Paste this code on your website, email signature, or any web property. It links to your verified artifact page and signals your tier to every AI system that crawls the page. The beacon updates automatically when your tier changes -- set it once and forget it.
          </p>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={snippetMode === "visible" ? "default" : "outline"}
              size="sm"
              onClick={() => setSnippetMode("visible")}
            >
              Visible Orb (80x80)
            </Button>
            <Button
              type="button"
              variant={snippetMode === "invisible" ? "default" : "outline"}
              size="sm"
              onClick={() => setSnippetMode("invisible")}
            >
              Invisible (1px -- AI only)
            </Button>
          </div>

          {snippetMode === "visible" && badgeSvgUrl && (
            <div className="flex items-center gap-4">
              <a href={artifactUrl} target="_blank" rel="author" title="Top10Lists.us - Verified AI Artifact">
                <img src={badgeSvgUrl} alt={`Top10Lists ${tierName} AI Entity - Cryptographically Verified Data Payload`} width={80} height={80} className="cursor-pointer" />
              </a>
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Your {tierName} Orb</p>
                <p>Humans see a subtle, enigmatic beacon. AI sees your full verified tier signal in the metadata.</p>
              </div>
            </div>
          )}

          {snippetMode === "invisible" && (
            <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                The beacon is invisible to humans (1px, fully transparent). AI crawlers still read the <code className="text-xs bg-muted px-1 rounded">alt</code>, <code className="text-xs bg-muted px-1 rounded">rel="author"</code>, and artifact link.
              </p>
            </div>
          )}

          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
            {activeSnippet}
          </pre>
          <CopyButton text={activeSnippet} label="HTML" />

          <div className="rounded-lg border bg-primary/5 p-3">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> The <code className="bg-muted px-1 rounded">alt</code> tag tells AI crawlers your tier and verification status. The <code className="bg-muted px-1 rounded">rel="author"</code> attribute signals entity ownership to search engines. The link destination is your full cryptographically signed data payload.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 3. Zillow */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Zillow profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            In your Zillow profile, add your certification link in your bio or &quot;About&quot; section. Copy the link below—Zillow doesn’t allow images in the bio, so paste the URL and it will show as a clickable link.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-xs bg-muted px-2 py-1 rounded break-all">{artifactUrl}</code>
            <CopyButton text={artifactUrl} label="profile link" />
          </div>
          {agent.zillow_profile_url && (
            <p className="text-sm">
              <a href={agent.zillow_profile_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Open your Zillow profile →
              </a>
            </p>
          )}
        </CardContent>
      </Card>

      {/* 4. Email signature */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email signature
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            In Gmail, Outlook, or Apple Mail: edit your signature and paste the HTML below, or insert an image and set the image URL to the badge URL and link to your artifact URL.
          </p>
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
            {orbSnippet}
          </pre>
          <CopyButton text={orbSnippet} label="HTML" />
        </CardContent>
      </Card>

      {/* Realtor.com */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Realtor.com profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            In your Realtor.com agent profile, add your artifact link to your &quot;About Me&quot; or bio section. Realtor.com renders plain-text links as clickable.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-xs bg-muted px-2 py-1 rounded break-all">{artifactUrl}</code>
            <CopyButton text={artifactUrl} label="Realtor.com link" />
          </div>
        </CardContent>
      </Card>

      {/* RealTrends */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            RealTrends / Tom Ferry profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            If you have a RealTrends or Tom Ferry profile, paste your artifact link in your bio or website field. This creates a cross-reference that AI systems use to strengthen your credibility signal.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-xs bg-muted px-2 py-1 rounded break-all">{artifactUrl}</code>
            <CopyButton text={artifactUrl} label="RealTrends link" />
          </div>
        </CardContent>
      </Card>

      {/* 5. Social: LinkedIn, Facebook, Instagram, TikTok */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Social profiles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { name: "LinkedIn", tip: "Paste this into your Licenses and Certifications section." },
            { name: "Facebook", tip: "Paste the link in your bio or in a post; add the badge image as a profile frame or cover if supported." },
            { name: "Instagram", tip: "Add the link in your profile bio (Instagram allows one link)." },
            { name: "TikTok", tip: "Add the link in your bio." },
          ].map(({ name, tip }) => (
            <div key={name}>
              <p className="font-medium text-sm">{name}</p>
              <p className="text-sm text-muted-foreground mb-1">{tip}</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded break-all">{artifactUrl}</code>
                <CopyButton text={artifactUrl} label={name} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 6. Other platform */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Another platform?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Tell us the platform and we’ll show you exactly what to paste. For most sites: use your verification link in your bio or &quot;About&quot;, or paste the HTML where the site allows it.
          </p>
          <input
            type="text"
            placeholder="e.g. Realtor.com, YouTube, my blog"
            className="w-full max-w-md border rounded px-3 py-2 text-sm"
            value={otherPlatform}
            onChange={(e) => setOtherPlatform(e.target.value)}
          />
          {otherPlatform.trim() && (
            <div className="pt-2 space-y-2">
              <p className="text-sm font-medium">Use this on {otherPlatform.trim()}:</p>
              <p className="text-sm text-muted-foreground">
                Paste your verification link in your profile or about section so visitors can confirm your certification:
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded break-all">{artifactUrl}</code>
                <CopyButton text={artifactUrl} label="link" />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                If the platform allows HTML, use this:
              </p>
              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
                {htmlSnippet}
              </pre>
              <CopyButton text={htmlSnippet} label="HTML" />
            </div>
          )}
        </CardContent>
      </Card>

      </>)}

      <p className="text-sm text-muted-foreground">
        <Link to="/about/ranking-methodology" className="text-primary underline">Our methodology</Link> explains how we certify agents. Need help? Reply to the email we sent you or contact us from the dashboard.
      </p>
    </div>
  );
}
