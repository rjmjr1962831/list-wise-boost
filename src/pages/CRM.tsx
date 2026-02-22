import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Users, ClipboardList, Mail, Zap } from "lucide-react";
import { EmailManager } from "@/components/crm/EmailManager";
import { toast } from "sonner";
import { ContactsManager } from "@/components/crm/ContactsManager";
import { TasksManager } from "@/components/crm/TasksManager";

type View = "contacts" | "tasks" | "email";

interface InstantlySyncResult {
  stats?: { total: number; created: number; updated: number; errors: number };
  error?: string;
}

const CRM = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<View>("contacts");
  const [pendingTaskCount, setPendingTaskCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (isAdmin) fetchPendingCount();
  }, [isAdmin]);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/admin/login"); return; }

      const { data: roles } = await supabase
        .from("admin_users")
        .select("role")
        .eq("id", user.id);

      if (!roles || !roles.some(r => r.role === "admin" || r.role === "superadmin")) {
        toast.error("You don't have access to CRM");
        navigate("/");
        return;
      }
      setIsAdmin(true);
    } catch {
      navigate("/admin/login");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPendingCount = async () => {
    const { count } = await supabase
      .from("field_change_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    setPendingTaskCount(count || 0);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out");
    navigate("/admin/login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const navItems: { id: View; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "contacts", label: "Contacts", icon: <Users className="h-5 w-5" /> },
    { id: "tasks",    label: "Tasks",    icon: <ClipboardList className="h-5 w-5" />, badge: pendingTaskCount },
    { id: "email",    label: "Email",    icon: <Mail className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Vertical sidebar */}
      <aside className="w-56 border-r bg-muted/30 flex flex-col">
        <div className="px-5 py-6 border-b">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">CRM</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors relative ${
                activeView === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="ml-auto -mt-4 -mr-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t space-y-1">
          <button
            onClick={() => navigate("/admin")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Back to Admin
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="px-8 py-8">
          <h1 className="text-2xl font-bold mb-6 capitalize">{activeView}</h1>
          {activeView === "contacts" && <ContactsManager />}
          {activeView === "tasks" && (
            <TasksManager onTaskResolved={fetchPendingCount} />
          )}
          {activeView === "email" && <EmailManager />}
        </div>
      </main>
    </div>
  );
};

export default CRM;
