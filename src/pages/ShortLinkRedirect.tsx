import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const ShortLinkRedirect = () => {
  const { shortCode } = useParams<{ shortCode: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    const lookupAndRedirect = async () => {
      if (!shortCode) {
        setError(true);
        return;
      }

      // First try current short_code
      let { data, error: queryError } = await supabase
        .from("professionals")
        .select("id, verification_token")
        .eq("short_code", shortCode)
        .maybeSingle();

      // If not found, check previous_short_codes array for backwards compatibility
      if (!data && !queryError) {
        const { data: historyData, error: historyError } = await supabase
          .from("professionals")
          .select("id, verification_token")
          .contains("previous_short_codes", [shortCode])
          .maybeSingle();
        
        if (!historyError && historyData) {
          data = historyData;
        }
      }

      if (queryError || !data) {
        setError(true);
        return;
      }

      // Redirect to profile page with verification token
      const token = data.verification_token || data.id;
      navigate(`/profile/${token}`, { replace: true });
    };

    lookupAndRedirect();
  }, [shortCode, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Link Not Found</h1>
          <p className="text-muted-foreground">This profile link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default ShortLinkRedirect;
