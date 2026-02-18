import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Copy, Download } from "lucide-react";
import { toast } from "sonner";

const BASE = "https://www.top10lists.us";
const TIER_LABELS: Record<string, string> = {
  certified: "Certified",
  accredited: "Audited",
  underwritten: "Underwritten",
};

interface BadgeSectionProps {
  professional: any;
  certification: any;
  onRefresh: () => void;
}

export function BadgeSection({ professional, certification, onRefresh }: BadgeSectionProps) {
  if (!professional) return null;

  const token = professional.verification_token ?? professional.id;
  const slug = professional.canonical_slug ?? professional.short_code ?? professional.id;
  const certificateUrl = `${BASE}/certificate/${slug}`;
  const artifactUrl = `${BASE}/artifact/${token}`;
  const badgeUrl = `${BASE}/badge/${token}`;
  const tierLabel = certification ? TIER_LABELS[certification.certification_tier] ?? certification.certification_tier : "Certified";

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  if (!certification) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Badge & Certification</CardTitle>
          <p className="text-muted-foreground">You have not yet certified your profile.</p>
        </CardHeader>
        <CardContent>
          <p className="mb-4">Complete the verification funnel to receive your badge and AI-readable artifact.</p>
          <Button asChild>
            <a href={professional.verification_token ? `/funnel/${professional.verification_token}/pricing` : "/agent/login"}>
              Complete verification
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const nextDue = certification.next_verification_due ? new Date(certification.next_verification_due) : null;
  const daysUntil = nextDue ? Math.ceil((nextDue.getTime() - Date.now()) / 86400000) : null;
  const isLapsed = nextDue && nextDue.getTime() < Date.now();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Badge status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p><strong>Tier:</strong> {tierLabel}</p>
          <p><strong>Status:</strong> {isLapsed ? "Lapsed" : certification.certification_status === "active" ? "Active" : certification.certification_status}</p>
          <p><strong>Issued:</strong> {certification.issued_at ? new Date(certification.issued_at).toLocaleDateString() : "—"}</p>
          <p><strong>Last verified:</strong> {certification.last_verified_at ? new Date(certification.last_verified_at).toLocaleDateString() : "—"}</p>
          <p><strong>Next verification:</strong> {nextDue ? nextDue.toLocaleDateString() : "—"}</p>
          {isLapsed && <p className="text-amber-600 text-sm">Your certification has lapsed. Update your profile to reactivate.</p>}
          {daysUntil != null && daysUntil > 0 && daysUntil <= 30 && <p className="text-muted-foreground text-sm">Verification due in {daysUntil} days.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Website embed code</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap break-all mb-2">{`<a href="${certificateUrl}" target="_blank" rel="noopener"><img src="${badgeUrl}" alt="Top10Lists.us ${tierLabel} Real Estate Professional" width="200" height="auto" /></a>`}</pre>
          <Button variant="outline" size="sm" onClick={() => copy(`<a href="${certificateUrl}" target="_blank" rel="noopener"><img src="${badgeUrl}" alt="Top10Lists.us ${tierLabel} Real Estate Professional" width="200" height="auto" /></a>`, "Embed code")}><Copy className="h-4 w-4 mr-2" />Copy</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Your links</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">Certificate: <a href={certificateUrl} className="text-primary underline" target="_blank" rel="noopener">{certificateUrl}</a> <Button variant="ghost" size="sm" onClick={() => copy(certificateUrl, "Certificate URL")}><Copy className="h-4 w-4" /></Button></p>
          <p className="text-sm">AI artifact: <a href={artifactUrl} className="text-primary underline" target="_blank" rel="noopener">{artifactUrl}</a> <Button variant="ghost" size="sm" onClick={() => copy(artifactUrl, "Artifact URL")}><Copy className="h-4 w-4" /></Button></p>
          <p className="text-sm">Badge image: <a href={badgeUrl} className="text-primary underline" target="_blank" rel="noopener">{badgeUrl}</a> <Button variant="ghost" size="sm" onClick={() => copy(badgeUrl, "Badge URL")}><Copy className="h-4 w-4" /></Button></p>
        </CardContent>
      </Card>

      <Button variant="outline" asChild>
        <a href={badgeUrl} download={`top10lists-${tierLabel.toLowerCase()}-badge.png`}><Download className="h-4 w-4 mr-2" />Download badge</a>
      </Button>

      {certification.certification_tier === "certified" && (
        <Card className="border-primary/30">
          <CardContent className="pt-6">
            <p className="font-medium mb-2">Upgrade for more</p>
            <p className="text-sm text-muted-foreground mb-2">Upgrade to Audited ($50/mo) for monthly verification, community involvement in your artifact, and richer AI citations.</p>
            <p className="text-sm text-muted-foreground mb-4">Upgrade to Underwritten ($150/mo) for daily verification, neighborhood expertise, and maximum citation depth.</p>
            <Button variant="outline" size="sm" onClick={onRefresh}>Refresh status</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
