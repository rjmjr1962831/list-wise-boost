import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Copy, Download } from "lucide-react";

export function AdminProspectsManager() {
  const { toast } = useToast();
  const [prospects, setProspects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCity, setFilterCity] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [cities, setCities] = useState<string[]>([]);

  useEffect(() => {
    fetchProspects();
    fetchCities();
  }, [filterCity, filterStatus]);

  const fetchCities = async () => {
    const { data } = await supabase
      .from("prospects")
      .select("city")
      .not("city", "is", null);

    const uniqueCities = Array.from(new Set(data?.map((p) => p.city) || []));
    setCities(uniqueCities);
  };

  const fetchProspects = async () => {
    setLoading(true);
    let query = supabase
      .from("prospects")
      .select("*")
      .not("zillow_position", "is", null)
      .order("zillow_position", { ascending: true });

    if (filterCity !== "all") {
      query = query.eq("city", filterCity);
    }

    if (filterStatus !== "all") {
      query = query.eq("status", filterStatus as 'new' | 'contacted' | 'interested' | 'customer' | 'declined');
    }

    const { data } = await query;
    setProspects(data || []);
    setLoading(false);
  };

  const updateStatus = async (prospectId: string, newStatus: 'new' | 'contacted' | 'interested' | 'customer' | 'declined') => {
    const { error } = await supabase
      .from("prospects")
      .update({ status: newStatus })
      .eq("id", prospectId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    } else {
      toast({ title: "Status Updated" });
      fetchProspects();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const exportCSV = () => {
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Company",
      "City",
      "State",
      "Position",
      "Page",
      "Agents Ahead",
      "Total Agents",
      "Rating",
      "Reviews",
      "Status",
      "Zillow URL",
    ];

    const rows = prospects.map((p) => [
      p.name,
      p.email || "",
      p.phone || "",
      p.company || "",
      p.city,
      p.state,
      p.zillow_position,
      p.zillow_page,
      p.agents_ahead,
      p.zillow_total_agents,
      p.zillow_rating || "",
      p.zillow_reviews || "",
      p.status,
      p.zillow_profile_url || "",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prospects-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const getPageColor = (page: number) => {
    if (page <= 2) return "text-green-600";
    if (page <= 4) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={filterCity} onValueChange={setFilterCity}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by City" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="interested">Interested</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={exportCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </Card>

      {/* Prospects Table */}
      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-semibold">Name</th>
                <th className="text-left p-3 font-semibold">Company</th>
                <th className="text-left p-3 font-semibold">City</th>
                <th className="text-center p-3 font-semibold">Position</th>
                <th className="text-center p-3 font-semibold">Page</th>
                <th className="text-center p-3 font-semibold">Ahead</th>
                <th className="text-center p-3 font-semibold">Rating</th>
                <th className="text-center p-3 font-semibold">Reviews</th>
                <th className="text-left p-3 font-semibold">Status</th>
                <th className="text-left p-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center p-6 text-muted-foreground">
                    Loading prospects...
                  </td>
                </tr>
              ) : prospects.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center p-6 text-muted-foreground">
                    No prospects found
                  </td>
                </tr>
              ) : (
                prospects.map((prospect) => (
                  <tr key={prospect.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">
                      <div>
                        <p className="font-medium">{prospect.name}</p>
                        {prospect.email && (
                          <p className="text-sm text-muted-foreground">{prospect.email}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-sm">{prospect.company || "N/A"}</td>
                    <td className="p-3 text-sm">
                      {prospect.city}, {prospect.state}
                    </td>
                    <td className="p-3 text-center font-mono">
                      #{prospect.zillow_position}
                    </td>
                    <td className={`p-3 text-center font-semibold ${getPageColor(prospect.zillow_page)}`}>
                      Page {prospect.zillow_page}
                    </td>
                    <td className="p-3 text-center text-muted-foreground">
                      {prospect.agents_ahead}
                    </td>
                    <td className="p-3 text-center">
                      {prospect.zillow_rating ? `⭐ ${prospect.zillow_rating}` : "N/A"}
                    </td>
                    <td className="p-3 text-center">
                      {prospect.zillow_reviews || "0"}
                    </td>
                    <td className="p-3">
                      <Select
                        value={prospect.status}
                        onValueChange={(value) => updateStatus(prospect.id, value as 'new' | 'contacted' | 'interested' | 'customer' | 'declined')}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="interested">Interested</SelectItem>
                          <SelectItem value="customer">Customer</SelectItem>
                          <SelectItem value="declined">Declined</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        {prospect.zillow_profile_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(prospect.zillow_profile_url, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(
                              `Position: #${prospect.zillow_position}, Page: ${prospect.zillow_page}, Ahead: ${prospect.agents_ahead}`
                            )
                          }
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
