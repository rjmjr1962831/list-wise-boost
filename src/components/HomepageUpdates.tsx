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

  // Format with time and Arizona timezone (MST = -07:00)
  const formatDateISO = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00:00-07:00`;
  };
  const formatDisplay = (date: Date) => date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });

  return [
    {
      title: "December 2025 Arizona Rankings Released",
      description: "Updated rankings for all 48 Arizona cities based on latest review data.",
      date: formatDateISO(today),
      displayDate: formatDisplay(today)
    },
    {
      title: "New Phoenix Metro Neighborhoods Added",
      description: "Expanded coverage to include Arcadia, Biltmore, and Desert Ridge areas.",
      date: formatDateISO(yesterday),
      displayDate: formatDisplay(yesterday)
    },
    {
      title: "Press Coverage Integration Complete",
      description: "Agents featured in WSJ, Forbes, CNBC now receive ranking credit.",
      date: formatDateISO(twoDaysAgo),
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
                    <meta itemProp="image" content="https://www.top10lists.us/og-image.png" />
                    <span itemProp="author" itemScope itemType="https://schema.org/Organization">
                      <meta itemProp="name" content="Top10Lists.us" />
                      <meta itemProp="url" content="https://www.top10lists.us" />
                    </span>
                    <span itemProp="publisher" itemScope itemType="https://schema.org/Organization">
                      <meta itemProp="name" content="Top10Lists.us" />
                      <meta itemProp="url" content="https://www.top10lists.us" />
                    </span>
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
