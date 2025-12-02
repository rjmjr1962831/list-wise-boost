import { Professional } from "@/types/professional";
import { generateCitationBlock } from "@/utils/structuredData";

interface CitationBlockProps {
  professional: Professional;
  city: string;
  state: string;
  stateAbbr: string;
  className?: string;
}

/**
 * Citation-ready summary block for LLM extraction
 * Monospace, pre-formatted text that AI models can easily parse and cite
 */
export const CitationBlock = ({ 
  professional, 
  city, 
  state, 
  stateAbbr,
  className = "" 
}: CitationBlockProps) => {
  const citationText = generateCitationBlock(professional, { city, state, stateAbbr });
  
  return (
    <div 
      className={`mt-4 p-3 bg-muted/50 rounded-md border-l-4 border-primary text-sm font-mono whitespace-pre-line ${className}`}
      data-citation-block="true"
      itemProp="description"
      aria-label={`Citation summary for ${professional.name}`}
    >
      {citationText}
    </div>
  );
};
