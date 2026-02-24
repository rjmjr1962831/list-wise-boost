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
import { Copy, Check, Download, Globe, Mail, Building2 } from "lucide-react";
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
  const badgeImageUrl = badgeId ? `${BASE}/api/v1/badge/${badgeId}/image` : "";
  const artifactUrl = artifactToken ? `${BASE}/artifact/${artifactToken}` : "";
  const tierLabel = (agent?.current_tier ?? "certified").replace(/_/g, " ");
  const htmlSnippet = badgeImageUrl && artifactUrl
    ? `<a href="${artifactUrl}" target="_blank" rel="noopener noreferrer"><img src="${badgeImageUrl}" alt="Top10Lists.us ${tierLabel} certification" width="120" height="60" style="border:0;" /></a>`
    : "";

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

      {/* 1. Download */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download your badge
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Right-click the image below and choose &quot;Save image as…&quot; to save the PNG. Or use the badge URL anywhere—it always serves your current tier.
          </p>
          {badgeImageUrl && (
            <>
              <a href={artifactUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
                <img src={badgeImageUrl} alt={`Top10Lists.us ${tierLabel} certification`} width={120} height={60} className="border rounded" />
              </a>
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded break-all">{badgeImageUrl}</code>
                <CopyButton text={badgeImageUrl} label="badge URL" />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 2. Your website */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Your website
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste this HTML where you want the badge (e.g. footer, sidebar, about page). The image links to your verification page.
          </p>
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
            {htmlSnippet}
          </pre>
          <CopyButton text={htmlSnippet} label="HTML" />
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
            {htmlSnippet}
          </pre>
          <CopyButton text={htmlSnippet} label="HTML" />
        </CardContent>
      </Card>

      {/* 5. Social: LinkedIn, Facebook, Instagram, TikTok */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Social profiles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { name: "LinkedIn", tip: "Add the link in your profile headline, about section, or featured link." },
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

      <p className="text-sm text-muted-foreground">
        <Link to="/methodology" className="text-primary underline">Our methodology</Link> explains how we certify agents. Need help? Reply to the email we sent you or contact us from the dashboard.
      </p>
    </div>
  );
}
