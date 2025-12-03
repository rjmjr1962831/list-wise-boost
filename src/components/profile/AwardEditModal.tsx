import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, Award, Calendar, Link, CheckCircle2, Info, Building2, ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AwardEntry {
  title?: string;
  name?: string;
  year?: number;
  date?: string;
  givenBy?: string;
  issuingOrganization?: string;
  url?: string;
  issuingOrgUrl?: string;
  verifiedAt?: string;
  type?: string;
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
  const [newAward, setNewAward] = useState({ name: "", givenBy: "", date: "", url: "" });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (open) {
      // Normalize existing awards
      const normalized = (currentAwards || []).map(a => ({
        title: a.title || a.name || "",
        name: a.name || a.title || "",
        year: a.year,
        date: a.date || (a.year ? `${a.year}-01-01` : undefined),
        givenBy: a.givenBy || a.issuingOrganization || "",
        issuingOrganization: a.issuingOrganization || a.givenBy || "",
        url: a.url || a.issuingOrgUrl || "",
        verifiedAt: a.verifiedAt,
        type: a.type || "award"
      }));
      setAwards(normalized);
      setNewAward({ name: "", givenBy: "", date: "", url: "" });
      setFormError("");
    }
  }, [open, currentAwards]);

  const isValidUrl = (url: string) => {
    if (!url) return true; // URL is optional
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleAddAward = () => {
    setFormError("");
    
    if (!newAward.name.trim()) {
      setFormError("Award name is required");
      return;
    }
    if (!newAward.givenBy.trim()) {
      setFormError("Given by (organization) is required");
      return;
    }
    if (!newAward.date) {
      setFormError("Date is required");
      return;
    }
    if (newAward.url && !isValidUrl(newAward.url)) {
      setFormError("Please enter a valid URL");
      return;
    }

    const dateObj = new Date(newAward.date);
    const year = dateObj.getFullYear();

    const newEntry: AwardEntry = {
      title: newAward.name.trim(),
      name: newAward.name.trim(),
      year: year,
      date: newAward.date,
      givenBy: newAward.givenBy.trim(),
      issuingOrganization: newAward.givenBy.trim(),
      url: newAward.url.trim() || undefined,
      issuingOrgUrl: newAward.url.trim() || undefined,
      verifiedAt: new Date().toISOString(),
      type: "award"
    };

    setAwards([...awards, newEntry]);
    setNewAward({ name: "", givenBy: "", date: "", url: "" });
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
                  <p>Add awards and recognitions you've received. A verification URL is optional but helps confirm the award.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          {/* Add New Award Form */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <h3 className="font-medium text-sm text-foreground">Add Award</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="award-name" className="text-xs flex items-center gap-1">
                  <Award className="h-3 w-3" />
                  Award Name *
                </Label>
                <Input
                  id="award-name"
                  value={newAward.name}
                  onChange={(e) => setNewAward({ ...newAward, name: e.target.value })}
                  placeholder="e.g., Top Producer 2024"
                  className="h-9"
                />
              </div>
              
              <div className="col-span-2 space-y-1">
                <Label htmlFor="award-given-by" className="text-xs flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Given By *
                </Label>
                <Input
                  id="award-given-by"
                  value={newAward.givenBy}
                  onChange={(e) => setNewAward({ ...newAward, givenBy: e.target.value })}
                  placeholder="e.g., Arizona Association of Realtors"
                  className="h-9"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="award-date" className="text-xs flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Date *
                </Label>
                <Input
                  id="award-date"
                  type="date"
                  value={newAward.date}
                  onChange={(e) => setNewAward({ ...newAward, date: e.target.value })}
                  className="h-9"
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="award-url" className="text-xs flex items-center gap-1">
                  <Link className="h-3 w-3" />
                  URL (optional)
                </Label>
                <Input
                  id="award-url"
                  type="url"
                  value={newAward.url}
                  onChange={(e) => setNewAward({ ...newAward, url: e.target.value })}
                  placeholder="https://..."
                  className="h-9"
                />
              </div>
            </div>

            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
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

          {/* Existing Awards */}
          <div className="flex-1 min-h-0">
            <h3 className="font-medium text-sm mb-2">Your Awards ({awards.length})</h3>
            <ScrollArea className="h-[220px]">
              {awards.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No awards added yet
                </p>
              ) : (
                <div className="space-y-2 pr-4">
                  {awards.map((award, index) => (
                    <div 
                      key={index} 
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">
                              {award.title || award.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {award.givenBy || award.issuingOrganization}
                              {(award.year || award.date) && ` • ${award.year || new Date(award.date!).getFullYear()}`}
                            </p>
                            {(award.url || award.issuingOrgUrl) && (
                              <a 
                                href={award.url || award.issuingOrgUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                View source
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => handleRemoveAward(index)}
                        title="Remove this award"
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
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
