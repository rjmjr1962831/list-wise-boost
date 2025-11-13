import { useEffect, useState } from 'react';
import { Brain } from 'lucide-react';

interface LoadingSearchProps {
  className?: string;
}

export const LoadingSearch = ({ className = '' }: LoadingSearchProps) => {
  // Avoid repeating the full "Searching" phase twice on initial mount transitions
  const initialPhase: 'searching' | 'analyzing' | 'building' =
    (typeof window !== 'undefined' && (window as any).__top10_loading_shown)
      ? 'analyzing'
      : 'searching';

  const [phase, setPhase] = useState<'searching' | 'analyzing' | 'building'>(initialPhase);
  const [sourcesShown, setSourcesShown] = useState<number>(initialPhase === 'searching' ? 0 : 4);

  const sources = ['Google', 'Agent websites', 'Yelp', 'Zillow', 'X', 'Instagram', 'Facebook'];

  useEffect(() => {
    // Mark that we've shown the loading once so consecutive mounts don't restart from the very beginning
    (window as any).__top10_loading_shown = true;
  }, []);

  useEffect(() => {
    // Show sources one by one
    if (phase === 'searching' && sourcesShown < sources.length) {
      const timer = setTimeout(() => {
        setSourcesShown(prev => prev + 1);
      }, 500);
      return () => clearTimeout(timer);
    }

    // Move to analyzing phase (after sources shown)
    if (phase === 'searching' && sourcesShown === sources.length) {
      const timer = setTimeout(() => {
        setPhase('analyzing');
      }, 800);
      return () => clearTimeout(timer);
    }

    // Move to building phase (analyzing for 3 seconds)
    if (phase === 'analyzing') {
      const timer = setTimeout(() => {
        setPhase('building');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [phase, sourcesShown, sources.length]);

  return (
    <div className={`flex flex-col items-center justify-center min-h-[400px] space-y-6 ${className}`}>
      {phase === 'searching' && (
        <>
          <div className="text-xl font-semibold text-foreground flex items-center gap-2">
            Searching more than 500,000 data points
            <span className="inline-flex gap-0.5">
              <span className="animate-[bounce_1s_ease-in-out_infinite]">.</span>
              <span className="animate-[bounce_1s_ease-in-out_0.2s_infinite]">.</span>
              <span className="animate-[bounce_1s_ease-in-out_0.4s_infinite]">.</span>
            </span>
          </div>
          
          <div className="flex flex-col items-center gap-3 text-lg text-muted-foreground">
            {sources.slice(0, sourcesShown).map((source, idx) => (
              <div 
                key={source} 
                className="animate-fade-in"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                {source}
              </div>
            ))}
          </div>
        </>
      )}

      {phase === 'analyzing' && (
        <div className="text-xl font-semibold text-foreground flex items-center gap-3">
          <Brain className="w-8 h-8 text-primary animate-pulse" />
          Analyzing
          <span className="inline-flex gap-0.5">
            <span className="animate-[bounce_1s_ease-in-out_infinite]">.</span>
            <span className="animate-[bounce_1s_ease-in-out_0.2s_infinite]">.</span>
            <span className="animate-[bounce_1s_ease-in-out_0.4s_infinite]">.</span>
          </span>
        </div>
      )}

      {phase === 'building' && (
        <div className="text-xl font-semibold text-foreground flex items-center gap-3">
          <Brain className="w-8 h-8 text-primary animate-pulse" />
          Building Top10list
          <span className="inline-flex gap-0.5">
            <span className="animate-[bounce_1s_ease-in-out_infinite]">.</span>
            <span className="animate-[bounce_1s_ease-in-out_0.2s_infinite]">.</span>
            <span className="animate-[bounce_1s_ease-in-out_0.4s_infinite]">.</span>
          </span>
        </div>
      )}
    </div>
  );
};
