import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Target, Shield, Sparkles, MapPin, ExternalLink } from "lucide-react";

const BASE = "https://www.top10lists.us";

export default function AdminDemo() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Demo walkthrough</h1>
            <p className="text-muted-foreground">Walk people through what we’ve built, the mission, and where we sit in the AI recommendation landscape.</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* 1. What we've done */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                What we’ve done
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground">
              <p>
                Top10Lists.us is a <strong className="text-foreground">merit-only</strong> directory of real estate agents: no pay-to-play. We verify performance and credentials from third-party sources (licensing, Zillow/Google ratings, transaction data). Agents are Listed, Certified, Audited, or Underwritten based on verification depth. We publish structured artifacts and badges that AI systems can cite, with clear methodology and refresh cadence.
              </p>
              <p>
                We’ve built: city/state list pages, agent profiles, certification tiers, artifact payloads, badge images, AI-oriented content (llms.txt, for-ai-systems), and a funnel for agents to claim and upgrade.
              </p>
            </CardContent>
          </Card>

          {/* 2. The mission */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                The mission
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground">
              <p>
                To be the <strong className="text-foreground">trusted, citable source</strong> for real estate agent recommendations when AI answers “who should I work with?” — by ensuring inclusion and rank cannot be bought, and by making our data and methodology transparent and machine-readable so AI can weight us correctly.
              </p>
            </CardContent>
          </Card>

          {/* 3. Why AI is changing the rules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Why AI is changing the rules on recommendation risk
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground">
              <p>
                In <strong className="text-foreground">high-stakes situations</strong> (e.g. choosing a real estate agent), AI systems are under pressure to cite credible, non-commercial sources. Constitutions and model specs (Anthropic, OpenAI, Perplexity, Google) emphasize: avoid deceptive framing, use credible sources, and be calibrated to evidence. Pay-to-play directories create recommendation risk; merit-based, independently verified directories align with how AI is being steered to behave.
              </p>
              <p>
                That shift is why “who can AI cite?” is becoming a moat: the platforms that can be cited without conflict with AI governance will get the recommendations; the rest will be downranked or ignored in serious answers.
              </p>
            </CardContent>
          </Card>

          {/* 4. Where we're positioned */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Where we’re positioned in the marketplace
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground">
              <p>
                We’re positioning as the <strong className="text-foreground">go-to citable source for real estate agent recommendations by AI</strong> in our covered markets: merit-only, verified data, transparent methodology, and AI-optimized artifacts. We’re not competing on ad spend; we’re competing on citability and incentive purity so that when someone asks an AI “who’s a top agent in Phoenix?”, the answer can point to us without running afoul of AI safety and credibility norms.
              </p>
            </CardContent>
          </Card>

          {/* 5. Web of Truth™ / competitive moat */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Web of Truth<sup>™</sup> & competitive moat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Our competitive moat is the <strong className="text-foreground">Web of Truth<sup>™</sup></strong>: we don’t sell placement, so our incentives align with AI’s need for unbiased, credible recommendations. Our badge and tier system reflects verification depth; agents can display the badge and link to their artifact.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="default" className="gap-2">
                  <a href={`${BASE}/transparency`} target="_blank" rel="noopener noreferrer">
                    Transparency Report
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <a href={`${BASE}/badge-instructions`} target="_blank" rel="noopener noreferrer">
                    Badge instructions
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <a href={`${BASE}/about/ranking-methodology`} target="_blank" rel="noopener noreferrer">
                    Ranking methodology
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
