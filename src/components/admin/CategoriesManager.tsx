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

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  plural_name: string;
  active: boolean;
}

const CategoriesManager = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    icon: "",
    plural_name: "",
    active: true,
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast.error("Failed to load categories: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("categories")
          .update(formData)
          .eq("id", editingCategory.id);
        if (error) throw error;
        toast.success("Category updated successfully");
      } else {
        const { error } = await supabase
          .from("categories")
          .insert([formData]);
        if (error) throw error;
        toast.success("Category created successfully");
      }
      setIsDialogOpen(false);
      resetForm();
      fetchCategories();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This will delete all professionals in this category.")) return;
    try {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
      toast.success("Category deleted successfully");
      fetchCategories();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      icon: category.icon || "",
      plural_name: category.plural_name,
      active: category.active,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingCategory(null);
    setFormData({
      name: "",
      slug: "",
      icon: "",
      plural_name: "",
      active: true,
    });
  };

  if (isLoading) {
    return <div>Loading categories...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Categories ({categories.length})</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? "Edit Category" : "Add New Category"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Category Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Dentist"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plural_name">Plural Name</Label>
                <Input
                  id="plural_name"
                  value={formData.plural_name}
                  onChange={(e) => setFormData({ ...formData, plural_name: e.target.value })}
                  placeholder="Dentists"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="top10dentists"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="icon">Icon (optional)</Label>
                <Input
                  id="icon"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="Stethoscope"
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
                {editingCategory ? "Update" : "Create"} Category
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Plural</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell>{category.plural_name}</TableCell>
                <TableCell className="font-mono text-sm">{category.slug}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded text-xs ${category.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {category.active ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(category)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(category.id)}>
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

export default CategoriesManager;