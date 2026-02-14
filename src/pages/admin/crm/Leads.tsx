import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface Lead {
  id: string;
  name: string;
  email: string;
  zillow_url: string;
  status: string;
  source: string;
  created_at: string;
  professional_id: string | null;
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('crm_leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching leads:', error);
    } else {
      setLeads(data || []);
    }
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-500',
      reviewing: 'bg-yellow-500',
      qualified: 'bg-green-500',
      disqualified: 'bg-red-500',
      contacted: 'bg-purple-500',
      certified: 'bg-emerald-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <Card>
        <CardHeader>
          <CardTitle>Form Submissions</CardTitle>
          <CardDescription>
            Leads from "Are You An Agent?" page ({leads.length} total)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No leads yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Zillow Profile</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Qualified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>{lead.email}</TableCell>
                    <TableCell>
                      <a
                        href={lead.zillow_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        View Profile
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(lead.status)}>
                        {lead.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lead.source}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(lead.created_at)}
                    </TableCell>
                    <TableCell>
                      {lead.professional_id ? (
                        <Badge variant="outline" className="bg-green-50">
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50">
                          No
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
