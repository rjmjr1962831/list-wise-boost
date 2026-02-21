import { useEffect, useRef } from "react";
import { SafeHead } from "@/components/SafeHead";

const WIDGET_URL = "https://www.top10lists.us/widget/badge.js";
const TEST_AGENT = "dina-and-mark-beauvais-4595";

type StyleVariant = "dark" | "light" | "minimal";

function BadgeSlot({ style }: { style: StyleVariant }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const script = document.createElement("script");
    script.src = WIDGET_URL;
    script.setAttribute("data-agent-id", TEST_AGENT);
    script.setAttribute("data-style", style);
    script.async = true;
    el.appendChild(script);

    return () => {
      el.querySelector("script")?.remove();
      el.querySelector(".t10l-badge-widget")?.remove();
      el.querySelector("noscript")?.remove();
    };
  }, [style]);

  return <div ref={containerRef} className="min-h-[120px] border rounded-lg p-4 bg-muted/20" />;
}

export default function BadgeDemo() {
  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <SafeHead>
        <title>Badge Widget Demo | Top10Lists.us</title>
        <meta name="description" content="Preview the embeddable trust badge widget in dark, light, and minimal styles." />
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <h1 className="text-xl font-semibold mb-1">Embeddable Badge Widget Demo</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Preview of the trust badge widget agents embed on their websites. Test agent:{" "}
        <a
          href={`https://www.top10lists.us/arizona/agents/${TEST_AGENT}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {TEST_AGENT}
        </a>
      </p>

      <section className="space-y-6">
        <div>
          <h2 className="font-medium mb-2 capitalize">Dark (default)</h2>
          <p className="text-xs text-muted-foreground mb-2">For light agent websites.</p>
          <BadgeSlot style="dark" />
        </div>

        <div>
          <h2 className="font-medium mb-2 capitalize">Light</h2>
          <p className="text-xs text-muted-foreground mb-2">For dark agent websites.</p>
          <div className="bg-slate-800 p-4 rounded-lg">
            <BadgeSlot style="light" />
          </div>
        </div>

        <div>
          <h2 className="font-medium mb-2 capitalize">Minimal</h2>
          <p className="text-xs text-muted-foreground mb-2">Compact inline badge.</p>
          <BadgeSlot style="minimal" />
        </div>
      </section>

      <section className="mt-8 p-4 border rounded-lg bg-muted/10">
        <h2 className="font-medium mb-2">Embed code</h2>
        <pre className="text-xs overflow-auto p-3 bg-background rounded font-mono whitespace-pre-wrap break-all">
{`<script src="${WIDGET_URL}"
        data-agent-id="your-canonical-slug"
        data-style="dark"
        async></script>`}
        </pre>
        <p className="text-xs text-muted-foreground mt-2">
          Replace <code>your-canonical-slug</code> with your agent&apos;s canonical slug. Styles: <code>dark</code>, <code>light</code>, <code>minimal</code>.
        </p>
      </section>
    </div>
  );
}
