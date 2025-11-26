import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Tag } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Specialty {
  id: string;
  name: string;
  active: boolean;
  category_id: string | null;
  created_at: string;
  created_by: string | null;
}

const SpecialtiesManager = () => {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSpecialty, setEditingSpecialty] = useState<Specialty | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [formData, setFormData] = useState({
    name: "",
    active: true,
  });

  // Real Estate Agent category ID
  const REAL_ESTATE_CATEGORY_ID = "1384f127-fc2e-4693-9b8f-406451adf3aa";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from("specialties")
        .select("*")
        .eq("category_id", REAL_ESTATE_CATEGORY_ID)
        .order("name", { ascending: true });

      if (error) throw error;
      setSpecialties(data || []);
    } catch (error: any) {
      toast.error("Failed to load data: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Specialty name is required");
      return;
    }

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in to add specialties");
        return;
      }

      const submitData = {
        name: formData.name.trim(),
        category_id: REAL_ESTATE_CATEGORY_ID,
        active: formData.active,
        ...(editingSpecialty ? {} : { created_by: user.id }),
      };

      if (editingSpecialty) {
        const { error } = await supabase
          .from("specialties")
          .update(submitData)
          .eq("id", editingSpecialty.id);
        if (error) {
          console.error("Update error:", error);
          throw error;
        }
        toast.success("Specialty updated successfully");
      } else {
        const { error } = await supabase
          .from("specialties")
          .insert([submitData]);
        if (error) {
          console.error("Insert error:", error);
          throw error;
        }
        toast.success("Specialty created successfully");
      }
      
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Specialty submission error:", error);
      if (error.message?.includes("duplicate")) {
        toast.error("A specialty with this name already exists");
      } else if (error.code === "PGRST301") {
        toast.error("Permission denied. Please make sure you're logged in as an admin.");
      } else {
        toast.error("Failed to save specialty: " + (error.message || "Unknown error"));
      }
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    
    try {
      const { error } = await supabase
        .from("specialties")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      toast.success("Specialty deleted successfully");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEdit = (specialty: Specialty) => {
    setEditingSpecialty(specialty);
    setFormData({
      name: specialty.name,
      active: specialty.active,
    });
    setIsDialogOpen(true);
  };

  const toggleActive = async (specialty: Specialty) => {
    try {
      const { error } = await supabase
        .from("specialties")
        .update({ active: !specialty.active })
        .eq("id", specialty.id);
      
      if (error) throw error;
      toast.success(`Specialty ${!specialty.active ? 'activated' : 'deactivated'}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const resetForm = () => {
    setEditingSpecialty(null);
    setFormData({
      name: "",
      active: true,
    });
  };

  const filteredSpecialties = specialties.filter(specialty => {
    const matchesSearch = specialty.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || 
      (filterStatus === "active" && specialty.active) || 
      (filterStatus === "inactive" && !specialty.active);
    
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return <div>Loading specialties...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Specialties ({filteredSpecialties.length} of {specialties.length})
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Manage professional specialties and their categories
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Specialty
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSpecialty ? "Edit Specialty" : "Add New Specialty"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Specialty Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Buyer's Agent, Luxury Homes, First-Time Buyers"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This specialty will be associated with Real Estate Agents
                </p>
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
                {editingSpecialty ? "Update" : "Create"} Specialty
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="search" className="mb-2">Search</Label>
            <Input
              id="search"
              placeholder="Search specialties..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-[150px]">
            <Label htmlFor="filter-status" className="mb-2">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger id="filter-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSpecialties.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No specialties found
                </TableCell>
              </TableRow>
            ) : (
              filteredSpecialties.map((specialty) => (
                <TableRow key={specialty.id}>
                  <TableCell className="font-medium">{specialty.name}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleActive(specialty)}
                      className="h-7 px-2"
                    >
                      <span className={`px-2 py-1 rounded text-xs ${
                        specialty.active 
                          ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400' 
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {specialty.active ? 'Active' : 'Inactive'}
                      </span>
                    </Button>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(specialty)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      onClick={() => handleDelete(specialty.id, specialty.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default SpecialtiesManager;
