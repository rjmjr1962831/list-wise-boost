import { Helmet } from 'react-helmet-async';
import { ZillowPayToPlay } from '@/components/pricing/ZillowPayToPlay';

export default function ZillowPayToPlayPage() {
  return (
    <>
      <Helmet>
        <title>Zillow Pay-to-Play Explained | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background py-12">
        <div className="container max-w-4xl">
          <ZillowPayToPlay />
        </div>
      </div>
    </>
  );
}
