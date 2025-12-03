import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";
import { useEffect, useRef } from "react";

const getUpdates = () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  const formatDisplay = (date: Date) => date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });

  return [
    {
      title: "December 2025 Arizona Rankings Released",
      description: "Updated rankings for all 48 Arizona cities based on latest review data.",
      date: formatDate(today),
      displayDate: formatDisplay(today)
    },
    {
      title: "New Phoenix Metro Neighborhoods Added",
      description: "Expanded coverage to include Arcadia, Biltmore, and Desert Ridge areas.",
      date: formatDate(yesterday),
      displayDate: formatDisplay(yesterday)
    },
    {
      title: "Press Coverage Integration Complete",
      description: "Agents featured in WSJ, Forbes, CNBC now receive ranking credit.",
      date: formatDate(twoDaysAgo),
      displayDate: formatDisplay(twoDaysAgo)
    }
  ];
};

export const HomepageUpdates = () => {
  const { trackEvent } = useGA4Tracking();
  const sectionRef = useRef<HTMLElement>(null);
  const hasTracked = useRef(false);
  const updates = getUpdates();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasTracked.current) {
          trackEvent('update_item_view', { page_path: '/' });
          hasTracked.current = true;
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [trackEvent]);

  return (
    <section ref={sectionRef} className="container mx-auto px-4 py-16 bg-muted/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Latest Updates
          </h2>
          <p className="text-muted-foreground text-lg">
            Rankings updated daily • Data refreshed continuously
          </p>
        </div>

        <div className="space-y-4">
          {updates.map((update, index) => (
            <Card 
              key={index}
              itemScope
              itemType="https://schema.org/NewsArticle"
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 
                        className="font-semibold"
                        itemProp="headline"
                      >
                        {update.title}
                      </h3>
                      <time 
                        dateTime={update.date}
                        itemProp="datePublished"
                        className="text-xs text-muted-foreground"
                      >
                        {update.displayDate}
                      </time>
                    </div>
                    <p 
                      className="text-sm text-muted-foreground"
                      itemProp="description"
                    >
                      {update.description}
                    </p>
                    <meta itemProp="author" content="Top10Lists.us" />
                    <meta itemProp="publisher" content="Top10Lists.us" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
