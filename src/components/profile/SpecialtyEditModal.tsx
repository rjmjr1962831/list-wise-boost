import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SpecialtyEditModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (specialties: string[]) => void;
  currentSpecialties: string[];
}

interface Specialty {
  id: string;
  name: string;
}

export default function SpecialtyEditModal({
  open,
  onClose,
  onSave,
  currentSpecialties
}: SpecialtyEditModalProps) {
  const { toast } = useToast();
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [availableSpecialties, setAvailableSpecialties] = useState<Specialty[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Initialize with current specialties when modal opens
  useEffect(() => {
    if (open) {
      setSpecialties(currentSpecialties || []);
      fetchAvailableSpecialties();
    }
  }, [open, currentSpecialties]);

  const fetchAvailableSpecialties = async () => {
    try {
      const { data, error } = await supabase
        .from("specialties")
        .select("id, name")
        .eq("active", true)
        .order("name");

      if (error) throw error;
      setAvailableSpecialties(data || []);
    } catch (error) {
      console.error("Error fetching specialties:", error);
    }
  };

  const handleRemoveSpecialty = (specialty: string) => {
    setSpecialties(prev => prev.filter(s => s !== specialty));
  };

  const handleAddSpecialty = async (specialtyName: string) => {
    const trimmedName = specialtyName.trim();
    if (!trimmedName) return;

    // Check if already in the list
    if (specialties.some(s => s.toLowerCase() === trimmedName.toLowerCase())) {
      toast({
        title: "Already Added",
        description: "This specialty is already in your list.",
        variant: "destructive"
      });
      return;
    }

    // Check if it exists in database (case insensitive)
    const existingSpecialty = availableSpecialties.find(
      s => s.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingSpecialty) {
      // Use the exact name from database
      setSpecialties(prev => [...prev, existingSpecialty.name]);
    } else {
      // Add new specialty to database
      try {
        const { data, error } = await supabase
          .from("specialties")
          .insert({ name: trimmedName, active: true })
          .select()
          .single();

        if (error) throw error;

        // Add to available list and selected list
        setAvailableSpecialties(prev => [...prev, { id: data.id, name: data.name }]);
        setSpecialties(prev => [...prev, data.name]);

        toast({
          title: "Specialty Added",
          description: `"${trimmedName}" has been added to your specialties.`
        });
      } catch (error: any) {
        console.error("Error adding specialty:", error);
        // If it already exists (race condition), just add it
        setSpecialties(prev => [...prev, trimmedName]);
      }
    }

    setSearchTerm("");
    setPopoverOpen(false);
  };

  const handleSave = () => {
    onSave(specialties);
    onClose();
  };

  const handleClose = () => {
    setSearchTerm("");
    setPopoverOpen(false);
    onClose();
  };

  // Filter suggestions based on search term, excluding already selected
  const filteredSuggestions = availableSpecialties.filter(
    s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
         !specialties.some(sel => sel.toLowerCase() === s.name.toLowerCase())
  );

  const showAddNew = searchTerm.trim() && 
    !availableSpecialties.some(s => s.name.toLowerCase() === searchTerm.trim().toLowerCase()) &&
    !specialties.some(s => s.toLowerCase() === searchTerm.trim().toLowerCase());

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Specialties</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Specialties */}
          <div>
            <p className="text-sm font-medium mb-2">Your Specialties</p>
            <div className="flex flex-wrap gap-2 min-h-[40px] p-3 border rounded-md bg-muted/30">
              {specialties.length === 0 ? (
                <span className="text-muted-foreground text-sm italic">No specialties selected</span>
              ) : (
                specialties.map((specialty, idx) => (
                  <Badge 
                    key={idx} 
                    variant="secondary" 
                    className="gap-1 pr-1"
                  >
                    {specialty}
                    <button
                      type="button"
                      onClick={() => handleRemoveSpecialty(specialty)}
                      className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
          </div>

          {/* Add Specialty */}
          <div>
            <p className="text-sm font-medium mb-2">Add Specialty</p>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search or type a new specialty..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (e.target.value) setPopoverOpen(true);
                    }}
                    onFocus={() => searchTerm && setPopoverOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchTerm.trim()) {
                        e.preventDefault();
                        handleAddSpecialty(searchTerm);
                      }
                    }}
                    className="pl-9"
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent 
                className="w-[--radix-popover-trigger-width] p-0" 
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <Command>
                  <CommandList>
                    {filteredSuggestions.length === 0 && !showAddNew && (
                      <CommandEmpty>No matching specialties found</CommandEmpty>
                    )}
                    {filteredSuggestions.length > 0 && (
                      <CommandGroup heading="Suggestions">
                        {filteredSuggestions.slice(0, 8).map((specialty) => (
                          <CommandItem
                            key={specialty.id}
                            onSelect={() => handleAddSpecialty(specialty.name)}
                            className="cursor-pointer"
                          >
                            <Plus className="h-4 w-4 mr-2 text-muted-foreground" />
                            {specialty.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {showAddNew && (
                      <CommandGroup heading="Add New">
                        <CommandItem
                          onSelect={() => handleAddSpecialty(searchTerm)}
                          className="cursor-pointer"
                        >
                          <Plus className="h-4 w-4 mr-2 text-primary" />
                          <span>Add "<span className="font-medium">{searchTerm.trim()}</span>"</span>
                        </CommandItem>
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground mt-1">
              Type to search existing specialties or add a new one
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
