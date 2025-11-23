import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserPlus, CheckCircle, Clock } from "lucide-react";

export const CRMDashboard = () => {
  const [stats, setStats] = useState({
    totalContacts: 0,
    totalLeads: 0,
    pendingFollowUps: 0,
    completedFollowUps: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const { count: contactsCount } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true });

    const { count: leadsCount } = await supabase
      .from("agent_applications")
      .select("*", { count: "exact", head: true });

    setStats({
      totalContacts: contactsCount || 0,
      totalLeads: leadsCount || 0,
      pendingFollowUps: 0,
      completedFollowUps: 0,
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalContacts}</div>
          <p className="text-xs text-muted-foreground">Contact form submissions</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Agent Leads</CardTitle>
          <UserPlus className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalLeads}</div>
          <p className="text-xs text-muted-foreground">Agent applications</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Follow-ups</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pendingFollowUps}</div>
          <p className="text-xs text-muted-foreground">Tasks to complete</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.completedFollowUps}</div>
          <p className="text-xs text-muted-foreground">Follow-ups done</p>
        </CardContent>
      </Card>
    </div>
  );
};
