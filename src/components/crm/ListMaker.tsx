/**
 * List Maker: Build agent lists by criteria, define output fields, get count, refine, download CSV.
 * CSV is uploaded to Supabase storage; link is returned (staging use only).
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Download, RefreshCw, Link2 } from "lucide-react";

export interface ListMakerCriteria {
  active?: boolean;
  state_slug?: string;
  current_tier?: string;
  min_rating?: number;
  email_verified?: boolean;
  has_license?: boolean;
}

const OUTPUT_FIELDS: { key: string; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "website", label: "Website" },
  { key: "company", label: "Company" },
  { key: "business_name", label: "Business Name" },
  { key: "title", label: "Title" },
  { key: "canonical_slug", label: "Canonical Slug" },
  { key: "state_slug", label: "State Slug" },
  { key: "current_tier", label: "Current Tier" },
  { key: "badge_tier", label: "Badge Tier" },
  { key: "review_stars_rating", label: "Review Rating" },
  { key: "num_total_reviews", label: "Review Count" },
  { key: "license_number", label: "License Number" },
  { key: "license_status", label: "License Status" },
  { key: "zillow_profile_url", label: "Zillow URL" },
  { key: "verification_token", label: "Verification Token" },
  { key: "city_name", label: "City Name" },
  { key: "city_slug", label: "City Slug" },
  { key: "created_at", label: "Created At" },
  { key: "updated_at", label: "Updated At" },
];

const STATES = [
  { value: "", label: "All states" },
  { value: "arizona", label: "Arizona" },
  { value: "california", label: "California" },
  { value: "texas", label: "Texas" },
  { value: "florida", label: "Florida" },
  { value: "colorado", label: "Colorado" },
  { value: "new-york", label: "New York" },
];

const TIERS = [
  { value: "", label: "All tiers" },
  { value: "listed", label: "Listed" },
  { value: "certified", label: "Certified" },
  { value: "audited", label: "Audited" },
  { value: "underwritten", label: "Underwritten" },
];

export function ListMaker() {
  const [criteria, setCriteria] = useState<ListMakerCriteria>({
    active: true,
    state_slug: "",
    current_tier: "",
    min_rating: 0,
    email_verified: false,
    has_license: false,
  });
  const [outputFields, setOutputFields] = useState<string[]>(["id", "name", "email", "phone", "state_slug"]);
  const [count, setCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastCsvUrl, setLastCsvUrl] = useState<string | null>(null);

  const buildQuery = useCallback(() => {
    let q = supabase.from("professionals").select("id", { count: "exact", head: true });
    if (criteria.active === true) q = q.eq("active", true);
    if (criteria.state_slug) q = q.eq("state_slug", criteria.state_slug);
    if (criteria.current_tier) q = q.eq("current_tier", criteria.current_tier);
    if (criteria.min_rating != null && criteria.min_rating > 0)
      q = q.gte("review_stars_rating", criteria.min_rating);
    if (criteria.email_verified) q = q.not("email_verified_at", "is", null);
    if (criteria.has_license)
      q = q.not("license_number", "is", null).neq("license_number", "");
    return q;
  }, [criteria]);

  const fetchCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      const { count: c, error } = await buildQuery();
      if (error) throw error;
      setCount(c ?? 0);
    } catch (e: any) {
      toast.error("Failed to get count: " + e.message);
      setCount(null);
    } finally {
      setLoadingCount(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  const handleRefine = () => {
    fetchCount();
    toast.info("Refined criteria; count updated.");
  };

  const handleDownloadCsv = async () => {
    if (outputFields.length === 0) {
      toast.error("Select at least one output field.");
      return;
    }
    setExporting(true);
    setLastCsvUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke("list-maker-export", {
        body: { criteria, outputFields },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const url = data?.url;
      if (!url) throw new Error("No URL returned");
      setLastCsvUrl(url);
      toast.success(`CSV ready: ${data?.count ?? 0} rows. Link below.`);
    } catch (e: any) {
      toast.error("Export failed: " + (e.message || e));
    } finally {
      setExporting(false);
    }
  };

  const toggleOutputField = (key: string, checked: boolean) => {
    setOutputFields((prev) =>
      checked ? [...prev, key] : prev.filter((k) => k !== key)
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Criteria</CardTitle>
          <CardDescription>Filter agents by these conditions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={!!criteria.active}
                onCheckedChange={(c) =>
                  setCriteria((prev) => ({ ...prev, active: !!c }))
                }
              />
              <span className="text-sm">Active only</span>
            </label>

            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">State</Label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={criteria.state_slug || ""}
                onChange={(e) =>
                  setCriteria((prev) => ({
                    ...prev,
                    state_slug: e.target.value || undefined,
                  }))
                }
              >
                {STATES.map((s) => (
                  <option key={s.value || "all"} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Tier</Label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={criteria.current_tier || ""}
                onChange={(e) =>
                  setCriteria((prev) => ({
                    ...prev,
                    current_tier: e.target.value || undefined,
                  }))
                }
              >
                {TIERS.map((t) => (
                  <option key={t.value || "all"} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Min rating</Label>
              <Input
                type="number"
                min={0}
                max={5}
                step={0.1}
                className="w-20 h-9"
                value={criteria.min_rating ?? ""}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setCriteria((prev) => ({
                    ...prev,
                    min_rating: isNaN(v) ? undefined : v,
                  }));
                }}
              />
            </div>

            <label className="flex items-center gap-2">
              <Checkbox
                checked={!!criteria.email_verified}
                onCheckedChange={(c) =>
                  setCriteria((prev) => ({ ...prev, email_verified: !!c }))
                }
              />
              <span className="text-sm">Email verified</span>
            </label>

            <label className="flex items-center gap-2">
              <Checkbox
                checked={!!criteria.has_license}
                onCheckedChange={(c) =>
                  setCriteria((prev) => ({ ...prev, has_license: !!c }))
                }
              />
              <span className="text-sm">Has license</span>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Output fields</CardTitle>
          <CardDescription>Select columns for the CSV</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {OUTPUT_FIELDS.map((f) => (
              <label
                key={f.key}
                className="flex items-center gap-2 cursor-pointer text-sm"
              >
                <Checkbox
                  checked={outputFields.includes(f.key)}
                  onCheckedChange={(c) => toggleOutputField(f.key, !!c)}
                />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            Count of matching agents, Refine to update, Download CSV for a link
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {loadingCount ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  count ?? "—"
                )}
              </span>
              <span className="text-muted-foreground">agents match</span>
            </div>

            <Button variant="outline" size="sm" onClick={handleRefine} disabled={loadingCount}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refine
            </Button>

            <Button
              size="sm"
              onClick={handleDownloadCsv}
              disabled={exporting || outputFields.length === 0}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download CSV
            </Button>
          </div>

          {lastCsvUrl && (
            <div className="rounded-md border bg-muted/50 p-4">
              <p className="text-sm font-medium mb-1">CSV ready (staging):</p>
              <a
                href={lastCsvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1 break-all"
              >
                <Link2 className="h-4 w-4 shrink-0" />
                {lastCsvUrl}
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
