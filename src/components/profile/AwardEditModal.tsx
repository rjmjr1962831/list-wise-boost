import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, Award, Calendar, Link, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AwardEntry {
  title?: string;
  name?: string;
  year?: number;
  date?: string;
  url?: string;
  issuingOrgUrl?: string;
  verifiedAt?: string;
}

interface AwardEditModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (awards: AwardEntry[]) => Promise<void>;
  currentAwards: AwardEntry[];
}

export default function AwardEditModal({
  open,
  onClose,
  onSave,
  currentAwards
}: AwardEditModalProps) {
  const [awards, setAwards] = useState<AwardEntry[]>([]);
  const [saving, setSaving] = useState(false);
  
  // New award form
  const [newAward, setNewAward] = useState({ name: "", year: "", url: "" });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (open) {
      // Normalize existing awards to consistent format
      const normalized = (currentAwards || []).map(a => ({
        title: a.title || a.name || "",
        name: a.name || a.title || "",
        year: a.year || (a.date ? new Date(a.date).getFullYear() : undefined),
        url: a.url || a.issuingOrgUrl || "",
        verifiedAt: a.verifiedAt
      }));
      setAwards(normalized);
      setNewAward({ name: "", year: "", url: "" });
      setFormError("");
    }
  }, [open, currentAwards]);

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const isAwardVerified = (award: AwardEntry) => {
    const hasName = !!(award.title || award.name);
    const hasYear = !!award.year;
    const hasUrl = !!(award.url || award.issuingOrgUrl) && isValidUrl(award.url || award.issuingOrgUrl || "");
    return hasName && hasYear && hasUrl;
  };

  const handleAddAward = () => {
    setFormError("");
    
    // Validate all fields
    if (!newAward.name.trim()) {
      setFormError("Award name is required");
      return;
    }
    if (!newAward.year || isNaN(Number(newAward.year))) {
      setFormError("Valid year is required");
      return;
    }
    const yearNum = Number(newAward.year);
    if (yearNum < 1900 || yearNum > new Date().getFullYear() + 1) {
      setFormError("Please enter a valid year");
      return;
    }
    if (!newAward.url.trim()) {
      setFormError("Verification URL is required");
      return;
    }
    if (!isValidUrl(newAward.url)) {
      setFormError("Please enter a valid URL (e.g., https://example.com)");
      return;
    }

    const newEntry: AwardEntry = {
      title: newAward.name.trim(),
      name: newAward.name.trim(),
      year: yearNum,
      url: newAward.url.trim(),
      verifiedAt: new Date().toISOString()
    };

    setAwards([...awards, newEntry]);
    setNewAward({ name: "", year: "", url: "" });
  };

  const handleRemoveAward = (index: number) => {
    setAwards(awards.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(awards);
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
            <Award className="h-5 w-5 text-yellow-600" />
            Awards & Achievements
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Awards must be verified by a third party. Please provide a link to where the award is publicly listed (e.g., your brokerage site, award organization's page, or press release).</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          {/* Add New Award Form */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <h3 className="font-medium text-sm text-foreground">Add New Award</h3>
            <p className="text-xs text-muted-foreground">
              All fields required for verification. Provide a URL where the award is listed.
            </p>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="award-name" className="text-xs flex items-center gap-1">
                  <Award className="h-3 w-3" />
                  Award Name
                </Label>
                <Input
                  id="award-name"
                  value={newAward.name}
                  onChange={(e) => setNewAward({ ...newAward, name: e.target.value })}
                  placeholder="e.g., Top Producer 2024"
                  className="h-9"
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="award-year" className="text-xs flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Year Received
                </Label>
                <Input
                  id="award-year"
                  type="number"
                  value={newAward.year}
                  onChange={(e) => setNewAward({ ...newAward, year: e.target.value })}
                  placeholder={`e.g., ${new Date().getFullYear()}`}
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  className="h-9"
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="award-url" className="text-xs flex items-center gap-1">
                  <Link className="h-3 w-3" />
                  Verification URL
                </Label>
                <Input
                  id="award-url"
                  type="url"
                  value={newAward.url}
                  onChange={(e) => setNewAward({ ...newAward, url: e.target.value })}
                  placeholder="https://example.com/award-listing"
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">
                  Link to where this award is publicly listed
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
                onClick={handleAddAward}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Award
              </Button>
            </div>
          </div>

          {/* Existing Awards */}
          <div className="flex-1 min-h-0">
            <h3 className="font-medium text-sm mb-2">Your Awards ({awards.length})</h3>
            <ScrollArea className="h-[200px]">
              {awards.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No awards added yet
                </p>
              ) : (
                <div className="space-y-2 pr-4">
                  {awards.map((award, index) => {
                    const verified = isAwardVerified(award);
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
                              {award.title || award.name}
                            </span>
                            {award.year && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                ({award.year})
                              </span>
                            )}
                          </div>
                          {(award.url || award.issuingOrgUrl) && (
                            <a 
                              href={award.url || award.issuingOrgUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline truncate block mt-1"
                            >
                              {award.url || award.issuingOrgUrl}
                            </a>
                          )}
                          {!verified && (
                            <p className="text-xs text-amber-600 mt-1">
                              Missing: {!award.year && "year, "}{!(award.url || award.issuingOrgUrl) && "verification URL"}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => handleRemoveAward(index)}
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
            Save Awards
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
