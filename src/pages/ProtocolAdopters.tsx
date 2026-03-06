import { SafeHead } from "@/components/SafeHead";
import { Link } from "react-router-dom";

/**
 * Organizations that have adopted the Top10Lists.us AI Citation Protocol.
 * Linked from AI Journal and other coverage; backlink equity for adopters.
 */
const ProtocolAdopters = () => {
  const adopters: { name: string; url?: string; description?: string }[] = [
    // Add adopters as they are approved (e.g. from send-protocol-adopter-emails flow)
  ];

  return (
    <>
      <SafeHead>
        <title>Protocol Adopters | AI Citation Protocol | Top10Lists.us</title>
        <meta
          name="description"
          content="Organizations that have adopted the Top10Lists.us AI Citation Protocol for transparent, attributable AI-generated recommendations."
        />
        <link rel="canonical" href="https://www.top10lists.us/protocol-adopters" />
      </SafeHead>
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-12 max-w-3xl">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            AI Citation Protocol Adopters
          </h1>
          <p className="text-muted-foreground mb-6">
            The <Link to="/protocol-services" className="underline text-primary">AI Citation Protocol</Link> defines how organizations publish machine-readable, attributable content so AI systems can recommend with confidence and cite sources. Organizations that adopt the protocol are listed below once approved.
          </p>
          {adopters.length === 0 ? (
            <p className="text-muted-foreground italic">
              Organizations that complete adoption will appear here. If your organization would like to adopt the protocol, contact{" "}
              <a href="mailto:hello@top10lists.us" className="underline text-primary">hello@top10lists.us</a>.
            </p>
          ) : (
            <ul className="space-y-4">
              {adopters.map((a) => (
                <li key={a.name} className="border rounded-lg p-4">
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                      {a.name}
                    </a>
                  ) : (
                    <span className="font-medium">{a.name}</span>
                  )}
                  {a.description && <p className="text-sm text-muted-foreground mt-1">{a.description}</p>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-8 text-sm text-muted-foreground">
            <Link to="/for-ai" className="underline text-primary">Guidance for AI systems</Link> and <Link to="/methodology" className="underline text-primary">methodology</Link>.
          </p>
        </main>
      </div>
    </>
  );
};

export default ProtocolAdopters;
