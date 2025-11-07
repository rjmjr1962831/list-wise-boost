import { memo } from "react";

interface TimelineEra {
  emoji: string;
  years: string;
  title: string;
  description: string;
  color: string;
}

const eras: TimelineEra[] = [
  {
    emoji: "🪨",
    years: "1990–1995",
    title: "The Stone Age",
    description: "First websites • Yahoo & AltaVista launch • Manual submissions • Pamela Anderson is the most searched term",
    color: "bg-gray-100 border-gray-300"
  },
  {
    emoji: "🤠",
    years: "1995–2000",
    title: "The Wild West",
    description: "Google's Backrub • SEO term coined • Hidden text & spam",
    color: "bg-orange-100 border-orange-300"
  },
  {
    emoji: "💰",
    years: "2000–2005",
    title: "The Gold Rush",
    description: "AdWords launches • Florida Update purge • SEO agencies emerge",
    color: "bg-yellow-100 border-yellow-300"
  },
  {
    emoji: "🏭",
    years: "2005–2010",
    title: "The Industrial Revolution",
    description: "Nofollow links • Bing launches • Focus on quality",
    color: "bg-blue-100 border-blue-300"
  },
  {
    emoji: "🌑",
    years: "2010–2015",
    title: "The Dark Ages",
    description: "Panda & Penguin • Hummingbird • End of tricks",
    color: "bg-purple-100 border-purple-300"
  },
  {
    emoji: "🎨",
    years: "2015–2020",
    title: "The Renaissance",
    description: "RankBrain AI • Mobile-first • BERT & intent",
    color: "bg-pink-100 border-pink-300"
  },
  {
    emoji: "🤖",
    years: "2020–2025",
    title: "The AI Revolution",
    description: "ChatGPT & Perplexity • Google SGE • GEO emerges",
    color: "bg-cyan-100 border-cyan-300"
  }
];

export const SEOTimeline = memo(() => {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {eras.map((era, index) => (
        <div 
          key={era.years}
          className="relative animate-fade-in"
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          {/* Timeline line */}
          {index !== eras.length - 1 && (
            <div className="absolute left-8 top-16 w-0.5 h-full bg-border hidden md:block" />
          )}
          
          {/* Era card */}
          <div className={`${era.color} border-2 rounded-lg p-4 md:p-6 relative hover:scale-[1.02] transition-transform`}>
            <div className="flex items-start gap-4">
              {/* Emoji icon */}
              <div className="flex-shrink-0 text-4xl md:text-5xl">
                {era.emoji}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                  <span className="text-sm font-bold text-muted-foreground">
                    {era.years}
                  </span>
                  <h3 className="text-xl md:text-2xl font-bold">
                    {era.title}
                  </h3>
                </div>
                <p className="text-sm md:text-base text-muted-foreground">
                  {era.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

SEOTimeline.displayName = "SEOTimeline";
