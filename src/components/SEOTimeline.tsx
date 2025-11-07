import { memo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface TimelineEra {
  emoji: string;
  years: string;
  title: string;
  description: string;
  strategies: string[];
  insight: string;
  color: string;
}

const eras: TimelineEra[] = [
  {
    emoji: "🪨",
    years: "1990–1995",
    title: "The Stone Age",
    description: "First websites • Yahoo & AltaVista launch • Manual submissions",
    strategies: [
      "Keyword stuffing: Repeating target keywords excessively on pages",
      "Meta tag manipulation: Overloading meta keywords and descriptions",
      "Manual directory submissions: Especially to Yahoo and DMOZ",
      "Hidden text and cloaking: White text on white backgrounds to game rankings"
    ],
    insight: "Search engines were primitive, so simple tricks worked—until they didn't.",
    color: "bg-gray-100 border-gray-300"
  },
  {
    emoji: "🤠",
    years: "1995–2000",
    title: "The Wild West",
    description: "Google's Backrub • SEO term coined • Hidden text & spam • Pamela Anderson is the most searched term",
    strategies: [
      "Backlink spamming: Quantity over quality; link farms and guestbooks",
      "Doorway pages: Thin pages stuffed with keywords to funnel traffic",
      "Exact-match domains: Domains like 'best-scottsdale-dentist.com' ranked easily",
      "Altavista and Lycos optimization: Tailoring content to specific engines"
    ],
    insight: "SEO was chaotic, with little regulation and lots of manipulation.",
    color: "bg-orange-100 border-orange-300"
  },
  {
    emoji: "💰",
    years: "2000–2005",
    title: "The Gold Rush",
    description: "AdWords launches • Google begins actively changing to combat sites trying to play the game • SEO agencies emerge",
    strategies: [
      "Google PageRank sculpting: Chasing backlinks from high-PR sites",
      "Anchor text optimization: Exact-match anchor text for link building",
      "Blog comment spam: Automated tools like XRumer flooded forums",
      "Early content marketing: Keyword-rich articles on microsites"
    ],
    insight: "Google's rise made backlinks king, and SEOs raced to exploit them.",
    color: "bg-yellow-100 border-yellow-300"
  },
  {
    emoji: "🏭",
    years: "2005–2010",
    title: "The Industrial Revolution",
    description: "Nofollow links • Bing launches • Focus on quality • Google is undisputed in the category. Continues to change to fight 'gamers.'",
    strategies: [
      "Content silos: Structuring sites by topic clusters",
      "Internal linking: Strategic anchor text within a site",
      "XML sitemaps & canonical tags: Helping Google crawl and index better",
      "Nofollow links: Managing link equity and spam"
    ],
    insight: "SEO matured into a technical discipline with better tools and structure.",
    color: "bg-blue-100 border-blue-300"
  },
  {
    emoji: "🌑",
    years: "2010–2015",
    title: "The Dark Ages",
    description: "Panda & Penguin • Hummingbird • End of tricks",
    strategies: [
      "Content quality focus: Post-Panda, thin content was penalized",
      "Disavow tools: Cleaning up toxic backlinks after Penguin",
      "Schema markup: Adding structured data for rich snippets",
      "Mobile optimization: Responsive design became essential"
    ],
    insight: "Google cracked down on manipulation, forcing SEOs to clean up their act.",
    color: "bg-purple-100 border-purple-300"
  },
  {
    emoji: "🎨",
    years: "2015–2020",
    title: "The Renaissance",
    description: "RankBrain AI • Mobile-first • BERT & intent",
    strategies: [
      "Topic authority: Long-form, intent-matched content",
      "Voice search optimization: Natural language and FAQs",
      "Mobile-first indexing: Speed and UX became ranking factors",
      "Featured snippet targeting: Structuring content to win position zero"
    ],
    insight: "SEO became more about user experience, semantics, and trust.",
    color: "bg-pink-100 border-pink-300"
  },
  {
    emoji: "🤖",
    years: "2020–2025",
    title: "The AI Revolution",
    description: "ChatGPT & Perplexity • Google SGE • GEO emerges",
    strategies: [
      "GEO (Generative Engine Optimization): Structuring content for LLM citation",
      "Entity-based SEO: Optimizing for people, places, and concepts",
      "Zero-click optimization: Winning AI summaries and featured answers",
      "Curated lists & structured data: Preferred by ChatGPT, Perplexity, and SGE"
    ],
    insight: "SEO is now about being the source AI trusts—not just what Google crawls.",
    color: "bg-cyan-100 border-cyan-300"
  }
];

export const SEOTimeline = memo(() => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

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
          <div className={`${era.color} border-2 rounded-lg p-4 md:p-6 relative transition-all duration-300 ${
            expandedIndex === index ? 'shadow-lg' : 'hover:scale-[1.02]'
          }`}>
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
                <p className="text-sm md:text-base text-muted-foreground mb-3">
                  {era.description}
                </p>

                {/* Expandable strategies section */}
                <div>
                  <button
                    onClick={() => toggleExpand(index)}
                    className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                  >
                    {expandedIndex === index ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Hide Top SEO Strategies of the era
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Show Top SEO Strategies of the era
                      </>
                    )}
                  </button>

                  {expandedIndex === index && (
                    <div className="mt-4 space-y-3 animate-accordion-down">
                      <div className="bg-background/50 rounded-lg p-4 space-y-2">
                        <h4 className="font-bold text-sm mb-2">Top Strategies:</h4>
                        <ul className="space-y-2">
                          {era.strategies.map((strategy, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex gap-2">
                              <span className="text-primary">•</span>
                              <span>{strategy}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <blockquote className="italic text-sm text-muted-foreground border-l-4 border-primary pl-4">
                        {era.insight}
                      </blockquote>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

SEOTimeline.displayName = "SEOTimeline";
