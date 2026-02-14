import { useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
      {copied ? <Check className="h-4 w-4 mr-2 text-green-600" /> : <Copy className="h-4 w-4 mr-2" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export interface AiColumnMarkdownProps {
  /** Markdown content with optional ```json code blocks */
  content: string;
  /** Optional full JSON for a global Copy button (e.g. full spec) */
  fullJson?: string;
  /** Label for the full JSON copy button */
  fullJsonLabel?: string;
  /** Optional footer text below the content */
  footer?: string;
}

export function AiColumnMarkdown({ content, fullJson, fullJsonLabel = "Copy full spec", footer }: AiColumnMarkdownProps) {
  return (
    <div className="flex flex-col min-h-0">
      <div className="prose prose-sm dark:prose-invert max-w-none flex-1 min-h-0 overflow-auto">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a({ href, children, ...props }) {
              if (href?.startsWith("/")) {
                return <Link to={href} {...props}>{children}</Link>;
              }
              return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
            },
            code({ node, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "");
              const code = String(children).replace(/\n$/, "");
              if (match && (match[1] === "json" || match[1] === "javascript")) {
                return (
                  <div className="not-prose my-3 rounded-lg border bg-muted/30 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50 shrink-0">
                      <span className="text-xs font-medium">{match[1].toUpperCase()}</span>
                      <CopyButton text={code} />
                    </div>
                    <pre className="p-4 overflow-auto text-sm font-mono whitespace-pre m-0">
                      <code {...props}>{code}</code>
                    </pre>
                  </div>
                );
              }
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
      {fullJson && (
        <div className="mt-4 shrink-0 flex items-center gap-2">
          <CopyButton text={fullJson} label={fullJsonLabel} />
          <span className="text-xs text-muted-foreground">Full spec</span>
        </div>
      )}
      {footer && <p className="text-sm text-muted-foreground shrink-0 mt-4">{footer}</p>}
    </div>
  );
}
