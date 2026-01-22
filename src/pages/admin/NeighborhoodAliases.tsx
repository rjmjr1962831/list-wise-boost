import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Loader2 } from "lucide-react";

interface NeighborhoodAlias {
  id: string;
  neighborhood_id: string;
  alias_slug: string;
  alias_name: string;
  created_at: string;
  neighborhood_catalog?: {
    neighborhood: string;
    neighborhood_slug: string;
    city_area: string;
    city_area_slug: string;
    primary_zip: string | null;
  };
}

interface NeighborhoodOption {
  id: string;
  neighborhood: string;
  neighborhood_slug: string;
  city_area: string;
  city_area_slug: string;
  primary_zip: string | null;
}

const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const NeighborhoodAliases = () => {
  const { toast } = useToast();
  const [aliases, setAliases] = useState<NeighborhoodAlias[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAlias, setEditingAlias] = useState<NeighborhoodAlias | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [aliasName, setAliasName] = useState("");
  const [aliasSlug, setAliasSlug] = useState("");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<NeighborhoodOption | null>(null);
  
  // Neighborhood search
  const [neighborhoodSearch, setNeighborhoodSearch] = useState("");
  const [neighborhoodResults, setNeighborhoodResults] = useState<NeighborhoodOption[]>([]);
  const [searchingNeighborhoods, setSearchingNeighborhoods] = useState(false);

  // Fetch aliases
  const fetchAliases = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('neighborhood_aliases')
      .select(`
        id,
        neighborhood_id,
        alias_slug,
        alias_name,
        created_at,
        neighborhood_catalog (
          neighborhood,
          neighborhood_slug,
          city_area,
          city_area_slug,
          primary_zip
        )
      `)
      .order('alias_name');

    if (error) {
      console.error('Error fetching aliases:', error);
      toast({ title: "Error", description: "Failed to load aliases", variant: "destructive" });
    } else {
      setAliases(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAliases();
  }, []);

  // Auto-generate slug from name
  useEffect(() => {
    if (!editingAlias) {
      setAliasSlug(generateSlug(aliasName));
    }
  }, [aliasName, editingAlias]);

  // Search neighborhoods
  const searchNeighborhoods = async (term: string) => {
    if (term.length < 2) {
      setNeighborhoodResults([]);
      return;
    }

    setSearchingNeighborhoods(true);
    const { data, error } = await supabase
      .from('neighborhood_catalog')
      .select('id, neighborhood, neighborhood_slug, city_area, city_area_slug, primary_zip')
      .eq('is_active', true)
      .or(`neighborhood.ilike.%${term}%,city_area.ilike.%${term}%`)
      .limit(10);

    if (!error && data) {
      setNeighborhoodResults(data);
    }
    setSearchingNeighborhoods(false);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      searchNeighborhoods(neighborhoodSearch);
    }, 300);
    return () => clearTimeout(timeout);
  }, [neighborhoodSearch]);

  // Open dialog for editing
  const openEditDialog = (alias: NeighborhoodAlias) => {
    setEditingAlias(alias);
    setAliasName(alias.alias_name);
    setAliasSlug(alias.alias_slug);
    if (alias.neighborhood_catalog) {
      setSelectedNeighborhood({
        id: alias.neighborhood_id,
        neighborhood: alias.neighborhood_catalog.neighborhood,
        neighborhood_slug: alias.neighborhood_catalog.neighborhood_slug,
        city_area: alias.neighborhood_catalog.city_area,
        city_area_slug: alias.neighborhood_catalog.city_area_slug,
        primary_zip: alias.neighborhood_catalog.primary_zip,
      });
      setNeighborhoodSearch(alias.neighborhood_catalog.neighborhood);
    }
    setDialogOpen(true);
  };

  // Open dialog for new alias
  const openNewDialog = () => {
    setEditingAlias(null);
    setAliasName("");
    setAliasSlug("");
    setSelectedNeighborhood(null);
    setNeighborhoodSearch("");
    setNeighborhoodResults([]);
    setDialogOpen(true);
  };

  // Save alias
  const saveAlias = async () => {
    if (!selectedNeighborhood || !aliasName || !aliasSlug) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      // Validate slug doesn't conflict with existing neighborhood_slug
      const { data: conflictCheck } = await supabase
        .from('neighborhood_catalog')
        .select('id')
        .eq('neighborhood_slug', aliasSlug)
        .maybeSingle();

      if (conflictCheck) {
        toast({ 
          title: "Error", 
          description: "This slug already exists as a primary neighborhood slug", 
          variant: "destructive" 
        });
        setSaving(false);
        return;
      }

      if (editingAlias) {
        // Update existing alias
        const { error } = await supabase
          .from('neighborhood_aliases')
          .update({
            neighborhood_id: selectedNeighborhood.id,
            alias_name: aliasName,
            alias_slug: aliasSlug,
          })
          .eq('id', editingAlias.id);

        if (error) throw error;
        toast({ title: "Success", description: "Alias updated successfully" });
      } else {
        // Create new alias
        const { error } = await supabase
          .from('neighborhood_aliases')
          .insert({
            neighborhood_id: selectedNeighborhood.id,
            alias_name: aliasName,
            alias_slug: aliasSlug,
          });

        if (error) throw error;
        toast({ title: "Success", description: "Alias created successfully" });
      }

      setDialogOpen(false);
      fetchAliases();
    } catch (error: any) {
      console.error('Error saving alias:', error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to save alias", 
        variant: "destructive" 
      });
    }

    setSaving(false);
  };

  // Delete alias
  const deleteAlias = async (alias: NeighborhoodAlias) => {
    if (!confirm(`Delete alias "${alias.alias_name}"?`)) return;

    const { error } = await supabase
      .from('neighborhood_aliases')
      .delete()
      .eq('id', alias.id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete alias", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Alias deleted successfully" });
      fetchAliases();
    }
  };

  // Filter aliases by search term
  const filteredAliases = aliases.filter(alias => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      alias.alias_name.toLowerCase().includes(term) ||
      alias.alias_slug.toLowerCase().includes(term) ||
      alias.neighborhood_catalog?.neighborhood.toLowerCase().includes(term) ||
      alias.neighborhood_catalog?.city_area.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Neighborhood Aliases</h2>
          <p className="text-muted-foreground">
            Manage alternate names for neighborhoods. Alias URLs redirect to canonical URLs.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Alias
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingAlias ? "Edit Alias" : "Add Neighborhood Alias"}</DialogTitle>
              <DialogDescription>
                Create an alternate name that redirects to the primary neighborhood URL.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Neighborhood Search */}
              <div className="space-y-2">
                <Label>Primary Neighborhood</Label>
                <div className="relative">
                  <Input
                    placeholder="Search neighborhoods..."
                    value={neighborhoodSearch}
                    onChange={(e) => {
                      setNeighborhoodSearch(e.target.value);
                      if (selectedNeighborhood) setSelectedNeighborhood(null);
                    }}
                  />
                  {searchingNeighborhoods && (
                    <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {neighborhoodResults.length > 0 && !selectedNeighborhood && (
                  <div className="border rounded-md max-h-48 overflow-y-auto">
                    {neighborhoodResults.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-muted text-sm"
                        onClick={() => {
                          setSelectedNeighborhood(n);
                          setNeighborhoodSearch(n.neighborhood);
                          setNeighborhoodResults([]);
                        }}
                      >
                        <div className="font-medium">{n.neighborhood}</div>
                        <div className="text-muted-foreground text-xs">
                          {n.city_area} • {n.primary_zip}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedNeighborhood && (
                  <div className="text-sm text-muted-foreground">
                    Selected: <span className="font-medium">{selectedNeighborhood.neighborhood}</span>
                    {" "}({selectedNeighborhood.city_area})
                  </div>
                )}
              </div>

              {/* Alias Name */}
              <div className="space-y-2">
                <Label htmlFor="alias-name">Alias Name</Label>
                <Input
                  id="alias-name"
                  placeholder="e.g., Sun City Grand"
                  value={aliasName}
                  onChange={(e) => setAliasName(e.target.value)}
                />
              </div>

              {/* Alias Slug */}
              <div className="space-y-2">
                <Label htmlFor="alias-slug">Alias Slug</Label>
                <Input
                  id="alias-slug"
                  placeholder="e.g., sun-city-grand"
                  value={aliasSlug}
                  onChange={(e) => setAliasSlug(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  URL-friendly slug (auto-generated from name)
                </p>
              </div>

              {/* Preview */}
              {selectedNeighborhood && aliasSlug && (
                <div className="p-3 bg-muted rounded-md text-sm">
                  <div className="font-medium mb-1">Redirect Preview:</div>
                  <div className="text-muted-foreground break-all">
                    /arizona/{selectedNeighborhood.city_area_slug}/{selectedNeighborhood.primary_zip}/{aliasSlug}/...
                  </div>
                  <div className="text-primary mt-1">
                    → /arizona/{selectedNeighborhood.city_area_slug}/{selectedNeighborhood.primary_zip}/{selectedNeighborhood.neighborhood_slug}/...
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveAlias} disabled={saving || !selectedNeighborhood || !aliasName || !aliasSlug}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {editingAlias ? "Update" : "Create"} Alias
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search aliases..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredAliases.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchTerm ? "No aliases match your search." : "No aliases configured yet."}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alias Name</TableHead>
              <TableHead>Alias Slug</TableHead>
              <TableHead>Primary Neighborhood</TableHead>
              <TableHead>City</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAliases.map((alias) => (
              <TableRow key={alias.id}>
                <TableCell className="font-medium">{alias.alias_name}</TableCell>
                <TableCell className="font-mono text-sm">{alias.alias_slug}</TableCell>
                <TableCell>{alias.neighborhood_catalog?.neighborhood || "—"}</TableCell>
                <TableCell>{alias.neighborhood_catalog?.city_area || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(alias)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteAlias(alias)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default NeighborhoodAliases;