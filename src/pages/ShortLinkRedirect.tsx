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

      // Short codes are deprecated — look up and redirect to canonical profile link or magic link
      let { data, error: queryError } = await supabase
        .from("professionals")
        .select("id, verification_token, profile_link")
        .eq("short_code", shortCode)
        .maybeSingle();

      // If not found, check previous_short_codes array for backwards compatibility
      if (!data && !queryError) {
        const { data: historyData, error: historyError } = await supabase
          .from("professionals")
          .select("id, verification_token, profile_link")
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

      // Redirect to canonical profile link if available, otherwise magic link
      if (data.profile_link) {
        // profile_link is a full URL — extract the path
        try {
          const url = new URL(data.profile_link);
          navigate(url.pathname, { replace: true });
        } catch {
          navigate(`/dashboard/${data.verification_token || data.id}`, { replace: true });
        }
      } else {
        const token = data.verification_token || data.id;
        navigate(`/dashboard/${token}`, { replace: true });
      }
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
