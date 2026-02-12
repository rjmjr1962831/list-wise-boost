import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Users, FileText, BarChart3, DollarSign, Activity, ExternalLink } from "lucide-react";

type View = 'dashboard' | 'leads' | 'agents' | 'pipeline' | 'revenue' | 'activity';

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

export default function UnifiedCRM() {
  const [activeView, setActiveView] = useState<View>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeView === 'leads' || activeView === 'dashboard') {
      fetchLeads();
    }
  }, [activeView]);

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

  const navItems = [
    { id: 'dashboard' as View, icon: LayoutDashboard, label: 'Dashboard', count: null },
    { id: 'leads' as View, icon: FileText, label: 'Leads', count: leads.length },
    { id: 'agents' as View, icon: Users, label: 'Agents', count: null },
    { id: 'pipeline' as View, icon: Activity, label: 'Pipeline', count: null },
    { id: 'revenue' as View, icon: DollarSign, label: 'Revenue', count: null },
    { id: 'activity' as View, icon: BarChart3, label: 'Analytics', count: null },
  ];

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

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{leads.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">From form submissions</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">New Today</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {leads.filter(l => {
                      const today = new Date().toDateString();
                      return new Date(l.created_at).toDateString() === today;
                    }).length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Last 24 hours</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Qualified</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {leads.filter(l => l.professional_id).length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Already in database</p>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'leads':
        if (loading) {
          return (
            <div className="animate-pulse">
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          );
        }

        return (
          <Card>
            <CardHeader>
              <CardTitle>Form Submissions</CardTitle>
              <CardDescription>
                Leads from "Are You An Agent?" page
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
                            View
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(lead.status)}>
                            {lead.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(lead.created_at)}
                        </TableCell>
                        <TableCell>
                          {lead.professional_id ? (
                            <Badge variant="outline" className="bg-green-50">Yes</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-50">No</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        );

      case 'agents':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Agents</CardTitle>
              <CardDescription>Certified professionals</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Agent management coming soon</p>
            </CardContent>
          </Card>
        );

      case 'pipeline':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Pipeline</CardTitle>
              <CardDescription>Certification funnel</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Pipeline view coming soon</p>
            </CardContent>
          </Card>
        );

      case 'revenue':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Revenue</CardTitle>
              <CardDescription>Subscription analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Revenue tracking coming soon</p>
            </CardContent>
          </Card>
        );

      case 'activity':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Analytics</CardTitle>
              <CardDescription>System activity and metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Analytics dashboard coming soon</p>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 bg-[#1a1f36] text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold">CRM</h1>
          <p className="text-sm text-gray-400">Top10Lists.us</p>
        </div>
        
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                  transition-colors text-left
                  ${isActive 
                    ? 'bg-[#2d3548] text-white' 
                    : 'text-gray-300 hover:bg-[#252b40] hover:text-white'
                  }
                `}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.count !== null && (
                  <Badge variant="secondary" className="bg-[#3d4556] text-white border-0">
                    {item.count}
                  </Badge>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
