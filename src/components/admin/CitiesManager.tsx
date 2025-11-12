import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface City {
  id: string;
  name: string;
  state: string;
  state_slug: string;
  slug: string;
  active: boolean;
}

const CitiesManager = () => {
  const [cities, setCities] = useState<City[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    state: "",
    state_slug: "",
    slug: "",
    active: true,
  });

  useEffect(() => {
    fetchCities();
  }, []);

  const fetchCities = async () => {
    try {
      const { data, error } = await supabase
        .from("cities")
        .select("*")
        .order("state", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setCities(data || []);
    } catch (error: any) {
      toast.error("Failed to load cities: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCity) {
        const { error } = await supabase
          .from("cities")
          .update(formData)
          .eq("id", editingCity.id);
        if (error) throw error;
        toast.success("City updated successfully");
      } else {
        const { data: newCity, error } = await supabase
          .from("cities")
          .insert([formData])
          .select()
          .single();
        if (error) throw error;
        
        toast.success("City created successfully");
        
        // Auto-import agents from Zillow in the background
        if (newCity) {
          toast.loading("Importing agents from Zillow...", { id: "zillow-import" });
          
          // Dynamic import to avoid circular dependencies
          const { autoImportZillowAgents } = await import("@/utils/zillowAutoImport");
          
          const importResult = await autoImportZillowAgents(
            newCity.id,
            formData.name,
            formData.state
          );
          
          if (importResult.success) {
            toast.success(
              `Successfully imported ${importResult.imported} agents from Zillow. Found ${importResult.licensesFound} license numbers.`,
              { id: "zillow-import" }
            );
          } else {
            toast.error(
              `Failed to import agents: ${importResult.errors.join(", ")}`,
              { id: "zillow-import" }
            );
          }
        }
      }
      setIsDialogOpen(false);
      resetForm();
      fetchCities();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this city?")) return;
    try {
      const { error } = await supabase.from("cities").delete().eq("id", id);
      if (error) throw error;
      toast.success("City deleted successfully");
      fetchCities();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEdit = (city: City) => {
    setEditingCity(city);
    setFormData({
      name: city.name,
      state: city.state,
      state_slug: city.state_slug,
      slug: city.slug,
      active: city.active,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingCity(null);
    setFormData({
      name: "",
      state: "",
      state_slug: "",
      slug: "",
      active: true,
    });
  };

  if (isLoading) {
    return <div>Loading cities...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Cities ({cities.length})</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add City
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCity ? "Edit City" : "Add New City"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">City Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="AZ"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state_slug">State Slug</Label>
                <Input
                  id="state_slug"
                  value={formData.state_slug}
                  onChange={(e) => setFormData({ ...formData, state_slug: e.target.value })}
                  placeholder="az"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">City Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="phoenix"
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label htmlFor="active">Active</Label>
              </div>
              <Button type="submit" className="w-full">
                {editingCity ? "Update" : "Create"} City
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>City</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cities.map((city) => (
              <TableRow key={city.id}>
                <TableCell className="font-medium">{city.name}</TableCell>
                <TableCell>{city.state}</TableCell>
                <TableCell className="font-mono text-sm">{city.state_slug}/{city.slug}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded text-xs ${city.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {city.active ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(city)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(city.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default CitiesManager;