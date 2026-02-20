/**
 * CopyableLink - Reusable component for displaying links with copy button
 * 
 * Usage:
 *   <CopyableLink url="https://example.com" />
 *   <CopyableLink url="https://example.com" label="My Link" showOpenButton />
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CopyableLinkProps {
  url: string;
  label?: string;
  showOpenButton?: boolean;
  className?: string;
  variant?: 'default' | 'compact' | 'inline';
}

export function CopyableLink({ 
  url, 
  label, 
  showOpenButton = true, 
  className,
  variant = 'default'
}: CopyableLinkProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    toast.success('Copied to clipboard');
  };

  const handleOpen = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (variant === 'inline') {
    return (
      <span className={cn('inline-flex items-center gap-2', className)}>
        <code className="text-xs bg-slate-100 px-2 py-1 rounded">
          {label ? (
            label
          ) : (
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {url}
            </a>
          )}
        </code>
        <button
          onClick={handleCopy}
          className="text-slate-500 hover:text-slate-700 transition-colors"
          title="Copy to clipboard"
        >
          <Copy className="w-3 h-3" />
        </button>
        {showOpenButton && (
          <button
            onClick={handleOpen}
            className="text-slate-500 hover:text-slate-700 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </span>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <code className="text-xs bg-slate-100 px-2 py-1 rounded flex-1 truncate">
          {label ? (
            label
          ) : (
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block">
              {url}
            </a>
          )}
        </code>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          title="Copy to clipboard"
          className="h-8 w-8 p-0"
        >
          <Copy className="w-4 h-4" />
        </Button>
        {showOpenButton && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleOpen}
            title="Open in new tab"
            className="h-8 w-8 p-0"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn('bg-slate-50 rounded-lg border p-3', className)}>
      {label && (
        <div className="text-sm font-medium text-slate-700 mb-2">
          {label}
        </div>
      )}
      <div className="flex items-center gap-2">
        <code className="text-xs bg-white px-3 py-2 rounded border flex-1 truncate">
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block">
            {url}
          </a>
        </code>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopy}
          title="Copy to clipboard"
        >
          <Copy className="w-4 h-4 mr-1" />
          Copy
        </Button>
        {showOpenButton && (
          <Button
            size="sm"
            onClick={handleOpen}
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            Open
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * CopyableText - For non-URL text that needs copying (tokens, IDs, etc.)
 */
interface CopyableTextProps {
  text: string;
  label?: string;
  className?: string;
  masked?: boolean; // Show first/last few chars only
}

export function CopyableText({ 
  text, 
  label, 
  className,
  masked = false 
}: CopyableTextProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const displayText = masked && text.length > 20
    ? `${text.slice(0, 8)}...${text.slice(-8)}`
    : text;

  return (
    <div className={cn('bg-slate-50 rounded-lg border p-3', className)}>
      {label && (
        <div className="text-sm font-medium text-slate-700 mb-2">
          {label}
        </div>
      )}
      <div className="flex items-center gap-2">
        <code className="text-xs bg-white px-3 py-2 rounded border flex-1 truncate font-mono">
          {displayText}
        </code>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopy}
          title="Copy to clipboard"
        >
          <Copy className="w-4 h-4 mr-1" />
          Copy
        </Button>
      </div>
    </div>
  );
}
