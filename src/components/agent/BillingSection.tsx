import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  ExternalLink, 
  Loader2, 
  Calendar, 
  MapPin,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Subscription {
  id: string;
  subscription_type: string;
  is_active: boolean;
  started_at: string | null;
  expires_at: string | null;
  stripe_subscription_id: string | null;
  city: {
    id: string;
    city_name: string;
    city_slug: string;
  } | null;
}

interface BillingSectionProps {
  professional: any;
  subscriptions: Subscription[];
  hasStripeSubscription: boolean;
}

export function BillingSection({
  professional,
  subscriptions,
  hasStripeSubscription,
}: BillingSectionProps) {
  const [loadingPortal, setLoadingPortal] = useState(false);

  const handleManagePayment = async () => {
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        body: { professionalId: professional.id },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        toast.error("Could not open payment portal");
      }
    } catch (error: any) {
      console.error("Error opening portal:", error);
      toast.error(error.message || "Failed to open payment portal");
    } finally {
      setLoadingPortal(false);
    }
  };

  const activeSubscriptions = subscriptions.filter((s) => s.is_active);
  const paidSubscriptions = activeSubscriptions.filter((s) => s.subscription_type !== "free");
  const freeSubscription = activeSubscriptions.find((s) => s.subscription_type === "free");

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    try {
      return format(new Date(dateStr), "MMM d, yyyy");
    } catch {
      return "N/A";
    }
  };

  const getSubscriptionLabel = (type: string) => {
    switch (type) {
      case "monthly":
        return "Monthly";
      case "annual":
        return "Annual";
      case "free":
        return "Free";
      default:
        return type;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Billing & Subscriptions
            </CardTitle>
            <CardDescription>Manage your city listings and payment methods</CardDescription>
          </div>
          {hasStripeSubscription && (
            <Button variant="outline" onClick={handleManagePayment} disabled={loadingPortal}>
              {loadingPortal ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Manage Payment
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {activeSubscriptions.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No active subscriptions</p>
            <p className="text-sm text-muted-foreground">
              Upgrade your profile to appear in more cities and get more leads.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Free City */}
            {freeSubscription && (
              <div className="p-4 border rounded-lg bg-muted/30">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {freeSubscription.city?.city_name || "Free Listing"}
                      </p>
                      <p className="text-sm text-muted-foreground">Included free city</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
              </div>
            )}

            {/* Paid Subscriptions */}
            {paidSubscriptions.map((sub) => (
              <div key={sub.id} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{sub.city?.city_name || "Unknown City"}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {getSubscriptionLabel(sub.subscription_type)}
                        </Badge>
                        {sub.started_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Since {formatDate(sub.started_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
                {sub.expires_at && (
                  <p className="text-xs text-muted-foreground mt-2 ml-13">
                    Renews: {formatDate(sub.expires_at)}
                  </p>
                )}
              </div>
            ))}

            {/* Summary */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Active Cities</span>
                <span className="font-medium">{activeSubscriptions.length}</span>
              </div>
              {paidSubscriptions.length > 0 && (
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Paid Cities</span>
                  <span className="font-medium">{paidSubscriptions.length}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
