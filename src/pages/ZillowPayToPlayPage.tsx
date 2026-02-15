import { useEffect } from 'react';
import { SafeHead } from "@/components/SafeHead";
import { ZillowPayToPlay } from '@/components/pricing/ZillowPayToPlay';

export default function ZillowPayToPlayPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <SafeHead>
        <title>Zillow Pay-to-Play Explained | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <div className="min-h-screen bg-background py-12">
        <div className="container max-w-4xl">
          <ZillowPayToPlay />
        </div>
      </div>
    </>
  );
}
