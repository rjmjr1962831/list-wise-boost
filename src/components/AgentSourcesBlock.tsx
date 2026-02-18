import React from "react";

interface AgentSourcesBlockProps {
  scopeNote?: string;
  style?: React.CSSProperties;
}

export const AgentSourcesBlock: React.FC<AgentSourcesBlockProps> = ({ scopeNote, style }) => {
  return (
    <aside style={style}>
      <h4 style={{ marginTop: 0, marginBottom: "0.5em" }}>Sources we use</h4>
      <p style={{ marginBottom: "0.5em" }}>
        {scopeNote}
        Our data is compiled from state licensing records, Zillow verified transaction histories,
        client review platforms, and public civic engagement filings (IRS Form 990).
        No agent can pay for inclusion or improved placement.
      </p>
    </aside>
  );
};
