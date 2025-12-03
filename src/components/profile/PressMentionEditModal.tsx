import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, Newspaper, Link, CheckCircle2, AlertCircle, Info, ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PressMentionEntry {
  title?: string;
  outlet?: string;
  date?: string;
  url?: string;
  verifiedAt?: string;
  type?: string;
}

interface PressMentionEditModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (mentions: PressMentionEntry[]) => Promise<void>;
  currentMentions: PressMentionEntry[];
}

export default function PressMentionEditModal({
  open,
  onClose,
  onSave,
  currentMentions
}: PressMentionEditModalProps) {
  const [mentions, setMentions] = useState<PressMentionEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const { toast } = useToast();
  
  // New mention URL input
  const [newUrl, setNewUrl] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (open) {
      // Filter to only show press type mentions (not awards)
      const pressMentions = (currentMentions || []).filter(m => m.type !== 'award');
      setMentions(pressMentions);
      setNewUrl("");
      setFormError("");
    }
  }, [open, currentMentions]);

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const isDuplicateUrl = (url: string) => {
    const normalizedNew = url.toLowerCase().replace(/\/$/, '');
    return mentions.some(m => 
      m.url?.toLowerCase().replace(/\/$/, '') === normalizedNew
    );
  };

  const handleAddMention = async () => {
    setFormError("");
    
    if (!newUrl.trim()) {
      setFormError("Please enter a URL");
      return;
    }
    if (!isValidUrl(newUrl)) {
      setFormError("Please enter a valid URL (e.g., https://example.com/article)");
      return;
    }
    if (isDuplicateUrl(newUrl)) {
      setFormError("This article has already been added");
      return;
    }

    setExtracting(true);
    
    try {
      // Call edge function to extract metadata from URL
      const { data, error } = await supabase.functions.invoke('extract-press-metadata', {
        body: { url: newUrl.trim() }
      });

      if (error) throw error;

      const newEntry: PressMentionEntry = {
        title: data?.title || "Article",
        outlet: data?.outlet || new URL(newUrl).hostname.replace('www.', ''),
        date: data?.date || undefined,
        url: newUrl.trim(),
        verifiedAt: new Date().toISOString(),
        type: "press"
      };

      setMentions([...mentions, newEntry]);
      setNewUrl("");
      
      toast({
        title: "Article Added",
        description: data?.title ? `"${data.title}" from ${newEntry.outlet}` : "Press mention added successfully"
      });
    } catch (error: any) {
      console.error("Error extracting metadata:", error);
      // Still add with basic info if extraction fails
      const newEntry: PressMentionEntry = {
        title: "Article",
        outlet: new URL(newUrl).hostname.replace('www.', ''),
        url: newUrl.trim(),
        verifiedAt: new Date().toISOString(),
        type: "press"
      };
      setMentions([...mentions, newEntry]);
      setNewUrl("");
      
      toast({
        title: "Article Added",
        description: "Added with basic info. Details will be verified manually."
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleRemoveMention = (index: number) => {
    setMentions(mentions.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(mentions);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && !extracting) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-blue-600" />
            Press Mentions
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Add links to articles where you are featured or mentioned. We'll automatically extract the article details.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          {/* Add New Mention Form */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <h3 className="font-medium text-sm text-foreground">Add Press Mention</h3>
            <p className="text-xs text-muted-foreground">
              Paste the URL of an article where you are featured. We'll extract the details automatically.
            </p>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="mention-url" className="text-xs flex items-center gap-1">
                  <Link className="h-3 w-3" />
                  Article URL
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="mention-url"
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://example.com/article-about-you"
                    className="h-9 flex-1"
                    disabled={extracting}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddMention();
                      }
                    }}
                  />
                  <Button 
                    type="button" 
                    size="sm"
                    onClick={handleAddMention}
                    disabled={extracting || !newUrl.trim()}
                    className="h-9"
                  >
                    {extracting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {formError}
                </div>
              )}
            </div>
          </div>

          {/* Existing Mentions */}
          <div className="flex-1 min-h-0">
            <h3 className="font-medium text-sm mb-2">Your Press Mentions ({mentions.length})</h3>
            <ScrollArea className="h-[250px]">
              {mentions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No press mentions added yet
                </p>
              ) : (
                <div className="space-y-2 pr-4">
                  {mentions.map((mention, index) => (
                    <div 
                      key={index} 
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm line-clamp-2">
                              {mention.title || "Article"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {mention.outlet}
                              {mention.date && ` • ${new Date(mention.date).toLocaleDateString()}`}
                            </p>
                            {mention.url && (
                              <a 
                                href={mention.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                View article
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => handleRemoveMention(index)}
                        title="Remove this mention"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving || extracting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || extracting}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
