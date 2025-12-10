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

      const { data, error: queryError } = await supabase
        .from("professionals")
        .select("id")
        .eq("short_code", shortCode)
        .maybeSingle();

      if (queryError || !data) {
        setError(true);
        return;
      }

      // Redirect to the full profile URL
      navigate(`/profile/${data.id}`, { replace: true });
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
