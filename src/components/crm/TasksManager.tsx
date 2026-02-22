import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock } from "lucide-react";

interface ChangeRequest {
  id: string;
  professional_id: string;
  field_name: string;
  current_value: string | null;
  proposed_value: string | null;
  change_request: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  professional_name?: string;
}

interface TasksManagerProps {
  onTaskResolved: () => void;
}

export const TasksManager = ({ onTaskResolved }: TasksManagerProps) => {
  const [tasks, setTasks] = useState<ChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  const fetchTasks = async () => {
    setIsLoading(true);
    let query = supabase
      .from("field_change_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter === "pending") query = query.eq("status", "pending");

    const { data, error } = await query;
    if (error) {
      toast.error("Failed to load tasks");
      console.error(error);
      setIsLoading(false);
      return;
    }

    // Enrich with professional names
    const enriched = await Promise.all((data || []).map(async (task) => {
      const { data: pro } = await supabase
        .from("professionals")
        .select("name")
        .eq("id", task.professional_id)
        .single();
      return { ...task, professional_name: pro?.name || "Unknown" };
    }));

    setTasks(enriched);
    setIsLoading(false);
  };

  const handleAccept = async (task: ChangeRequest) => {
    setProcessing(task.id);
    try {
      // Update the professional record
      // Only fields that have a "Request review" button in the onboarding funnel
      const fieldMap: Record<string, string> = {
        "Name": "name",
        "License Number": "license_number",
        "Reviews": "num_total_reviews",
        "Years of Experience": "years_experience",
        "Total Sales": "total_sales",
      };
      const dbField = fieldMap[task.field_name];
      if (dbField && task.proposed_value) {
        await supabase
          .from("professionals")
          .update({ [dbField]: task.proposed_value })
          .eq("id", task.professional_id);
      }

      // Mark resolved
      await supabase
        .from("field_change_requests")
        .update({ status: "accepted", reviewed_at: new Date().toISOString() })
        .eq("id", task.id);

      toast.success("Change accepted and applied.");
      await fetchTasks();
      onTaskResolved();
    } catch (e) {
      toast.error("Failed to accept change");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (task: ChangeRequest) => {
    const reason = rejectReasons[task.id] || "";
    setProcessing(task.id);
    try {
      await supabase
        .from("field_change_requests")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", task.id);

      toast.success("Change rejected.");
      await fetchTasks();
      onTaskResolved();
    } catch (e) {
      toast.error("Failed to reject change");
    } finally {
      setProcessing(null);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "pending")  return <Badge variant="outline" className="text-yellow-600 border-yellow-400"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    if (status === "accepted") return <Badge variant="outline" className="text-green-600 border-green-400"><CheckCircle className="h-3 w-3 mr-1" />Accepted</Badge>;
    return <Badge variant="outline" className="text-red-600 border-red-400"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => setFilter("pending")}
          className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${filter === "pending" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          Pending
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${filter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          All
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {!isLoading && tasks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No {filter === "pending" ? "pending " : ""}tasks.
          </CardContent>
        </Card>
      )}

      {tasks.map(task => (
        <Card key={task.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">{task.professional_name}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(task.created_at), "MMM d, yyyy h:mm a")}
                </p>
              </div>
              {statusBadge(task.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-muted/40 rounded p-3">
                <p className="text-xs text-muted-foreground mb-1">Field</p>
                <p className="font-medium">{task.field_name}</p>
              </div>
              <div className="bg-muted/40 rounded p-3">
                <p className="text-xs text-muted-foreground mb-1">Current</p>
                <p className="font-mono text-xs break-all">{task.current_value || "—"}</p>
              </div>
              <div className="bg-blue-50 rounded p-3">
                <p className="text-xs text-muted-foreground mb-1">Proposed</p>
                <p className="font-mono text-xs break-all">{task.proposed_value || "—"}</p>
              </div>
            </div>

            {task.change_request && (
              <div className="bg-muted/30 rounded p-3 text-sm">
                <p className="text-xs text-muted-foreground mb-1">Agent note</p>
                <p>{task.change_request}</p>
              </div>
            )}

            {task.status === "pending" && (
              <div className="space-y-2 pt-1">
                <Textarea
                  placeholder="Reason for rejection (optional)"
                  className="text-sm min-h-[60px]"
                  value={rejectReasons[task.id] || ""}
                  onChange={e => setRejectReasons(prev => ({ ...prev, [task.id]: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAccept(task)}
                    disabled={processing === task.id}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReject(task)}
                    disabled={processing === task.id}
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
