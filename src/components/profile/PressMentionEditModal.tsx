import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, Newspaper, Calendar, Link, CheckCircle2, AlertCircle, Info, Building2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  
  // New mention form
  const [newMention, setNewMention] = useState({ title: "", outlet: "", date: "", url: "" });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (open) {
      // Normalize existing mentions
      const normalized = (currentMentions || []).map(m => ({
        title: m.title || "",
        outlet: m.outlet || "",
        date: m.date || "",
        url: m.url || "",
        verifiedAt: m.verifiedAt,
        type: m.type || "press"
      }));
      setMentions(normalized);
      setNewMention({ title: "", outlet: "", date: "", url: "" });
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

  const isMentionVerified = (mention: PressMentionEntry) => {
    const hasTitle = !!mention.title;
    const hasOutlet = !!mention.outlet;
    const hasUrl = !!mention.url && isValidUrl(mention.url);
    return hasTitle && hasOutlet && hasUrl;
  };

  const handleAddMention = () => {
    setFormError("");
    
    // Validate all fields
    if (!newMention.title.trim()) {
      setFormError("Article title/headline is required");
      return;
    }
    if (!newMention.outlet.trim()) {
      setFormError("Publication/outlet name is required");
      return;
    }
    if (!newMention.url.trim()) {
      setFormError("Article URL is required");
      return;
    }
    if (!isValidUrl(newMention.url)) {
      setFormError("Please enter a valid URL (e.g., https://example.com/article)");
      return;
    }

    const newEntry: PressMentionEntry = {
      title: newMention.title.trim(),
      outlet: newMention.outlet.trim(),
      date: newMention.date || undefined,
      url: newMention.url.trim(),
      verifiedAt: new Date().toISOString(),
      type: "press"
    };

    setMentions([...mentions, newEntry]);
    setNewMention({ title: "", outlet: "", date: "", url: "" });
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
    if (!isOpen) {
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
                  <p>Press mentions must be verifiable. Please provide a link to the published article or media coverage where you are mentioned.</p>
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
              Provide a link to the article where you are featured or mentioned.
            </p>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="mention-title" className="text-xs flex items-center gap-1">
                  <Newspaper className="h-3 w-3" />
                  Article Title/Headline
                </Label>
                <Input
                  id="mention-title"
                  value={newMention.title}
                  onChange={(e) => setNewMention({ ...newMention, title: e.target.value })}
                  placeholder="e.g., Top Agents to Watch in 2024"
                  className="h-9"
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="mention-outlet" className="text-xs flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Publication/Outlet
                </Label>
                <Input
                  id="mention-outlet"
                  value={newMention.outlet}
                  onChange={(e) => setNewMention({ ...newMention, outlet: e.target.value })}
                  placeholder="e.g., Arizona Republic, Forbes, etc."
                  className="h-9"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="mention-date" className="text-xs flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Date Published (optional)
                </Label>
                <Input
                  id="mention-date"
                  type="date"
                  value={newMention.date}
                  onChange={(e) => setNewMention({ ...newMention, date: e.target.value })}
                  className="h-9"
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="mention-url" className="text-xs flex items-center gap-1">
                  <Link className="h-3 w-3" />
                  Article URL
                </Label>
                <Input
                  id="mention-url"
                  type="url"
                  value={newMention.url}
                  onChange={(e) => setNewMention({ ...newMention, url: e.target.value })}
                  placeholder="https://example.com/article"
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">
                  Link to the published article
                </p>
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {formError}
                </div>
              )}

              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={handleAddMention}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Press Mention
              </Button>
            </div>
          </div>

          {/* Existing Mentions */}
          <div className="flex-1 min-h-0">
            <h3 className="font-medium text-sm mb-2">Your Press Mentions ({mentions.length})</h3>
            <ScrollArea className="h-[200px]">
              {mentions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No press mentions added yet
                </p>
              ) : (
                <div className="space-y-2 pr-4">
                  {mentions.map((mention, index) => {
                    const verified = isMentionVerified(mention);
                    return (
                      <div 
                        key={index} 
                        className={`flex items-start gap-3 p-3 rounded-lg border ${verified ? 'bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-800/30' : 'bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/30'}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {verified ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                            )}
                            <span className="font-medium text-sm truncate">
                              {mention.title}
                            </span>
                          </div>
                          {mention.outlet && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {mention.outlet}
                              {mention.date && ` • ${new Date(mention.date).toLocaleDateString()}`}
                            </p>
                          )}
                          {mention.url && (
                            <a 
                              href={mention.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline truncate block mt-1"
                            >
                              {mention.url}
                            </a>
                          )}
                          {!verified && (
                            <p className="text-xs text-amber-600 mt-1">
                              Missing: {!mention.title && "title, "}{!mention.outlet && "outlet, "}{!mention.url && "URL"}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => handleRemoveMention(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Press Mentions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
