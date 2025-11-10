import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Professional {
  id: string;
  name: string;
  title: string | null;
  city_id: string;
  category_id: string;
  type: string;
  rank: number;
  active: boolean;
  cities?: { name: string };
  categories?: { name: string };
}

interface City {
  id: string;
  name: string;
  state: string;
}

interface Category {
  id: string;
  name: string;
}

const ProfessionalsManager = () => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    title: "",
    city_id: "",
    category_id: "",
    type: "established",
    rank: 1,
    image_url: "",
    years_experience: 0,
    specialty: "",
    phone: "",
    email: "",
    website: "",
    description: "",
    badges: "",
    active: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [profRes, citiesRes, catsRes] = await Promise.all([
        supabase
          .from("professionals")
          .select("*, cities(name, state), categories(name)")
          .order("rank", { ascending: true }),
        supabase.from("cities").select("*").eq("active", true).order("name"),
        supabase.from("categories").select("*").eq("active", true).order("name"),
      ]);

      if (profRes.error) throw profRes.error;
      if (citiesRes.error) throw citiesRes.error;
      if (catsRes.error) throw catsRes.error;

      setProfessionals(profRes.data || []);
      setCities(citiesRes.data || []);
      setCategories(catsRes.data || []);
    } catch (error: any) {
      toast.error("Failed to load data: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        specialty: formData.specialty.split(",").map(s => s.trim()).filter(Boolean),
        badges: formData.badges.split(",").map(b => b.trim()).filter(Boolean),
      };

      if (editingProfessional) {
        const { error } = await supabase
          .from("professionals")
          .update(submitData)
          .eq("id", editingProfessional.id);
        if (error) throw error;
        toast.success("Professional updated successfully");
      } else {
        const { error } = await supabase
          .from("professionals")
          .insert([submitData]);
        if (error) throw error;
        toast.success("Professional created successfully");
      }
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this professional?")) return;
    try {
      const { error } = await supabase.from("professionals").delete().eq("id", id);
      if (error) throw error;
      toast.success("Professional deleted successfully");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEdit = async (professional: Professional) => {
    const { data } = await supabase
      .from("professionals")
      .select("*")
      .eq("id", professional.id)
      .single();

    if (data) {
      setEditingProfessional(data);
      setFormData({
        name: data.name,
        title: data.title || "",
        city_id: data.city_id,
        category_id: data.category_id,
        type: data.type,
        rank: data.rank,
        image_url: data.image_url || "",
        years_experience: data.years_experience || 0,
        specialty: data.specialty?.join(", ") || "",
        phone: data.phone || "",
        email: data.email || "",
        website: data.website || "",
        description: data.description || "",
        badges: data.badges?.join(", ") || "",
        active: data.active,
      });
      setIsDialogOpen(true);
    }
  };

  const resetForm = () => {
    setEditingProfessional(null);
    setFormData({
      name: "",
      title: "",
      city_id: "",
      category_id: "",
      type: "established",
      rank: 1,
      image_url: "",
      years_experience: 0,
      specialty: "",
      phone: "",
      email: "",
      website: "",
      description: "",
      badges: "",
      active: true,
    });
  };

  if (isLoading) {
    return <div>Loading professionals...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Professionals ({professionals.length})</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Professional
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProfessional ? "Edit Professional" : "Add New Professional"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city_id">City *</Label>
                  <Select value={formData.city_id} onValueChange={(value) => setFormData({ ...formData, city_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((city) => (
                        <SelectItem key={city.id} value={city.id}>
                          {city.name}, {city.state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category_id">Category *</Label>
                  <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type *</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="established">Established</SelectItem>
                      <SelectItem value="emerging">Emerging</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rank">Rank *</Label>
                  <Input
                    id="rank"
                    type="number"
                    value={formData.rank}
                    onChange={(e) => setFormData({ ...formData, rank: parseInt(e.target.value) })}
                    min="1"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="years_experience">Experience (years)</Label>
                  <Input
                    id="years_experience"
                    type="number"
                    value={formData.years_experience}
                    onChange={(e) => setFormData({ ...formData, years_experience: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="image_url">Image URL</Label>
                <Input
                  id="image_url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialty">Specialties (comma-separated)</Label>
                <Input
                  id="specialty"
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  placeholder="Cosmetic Dentistry, Implants"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="badges">Badges (comma-separated)</Label>
                <Input
                  id="badges"
                  value={formData.badges}
                  onChange={(e) => setFormData({ ...formData, badges: e.target.value })}
                  placeholder="Top Rated, Verified"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
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
                {editingProfessional ? "Update" : "Create"} Professional
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {professionals.map((prof) => (
              <TableRow key={prof.id}>
                <TableCell className="font-mono">{prof.rank}</TableCell>
                <TableCell className="font-medium">{prof.name}</TableCell>
                <TableCell>{prof.cities?.name}</TableCell>
                <TableCell>{prof.categories?.name}</TableCell>
                <TableCell className="capitalize">{prof.type}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded text-xs ${prof.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {prof.active ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(prof)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(prof.id)}>
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

export default ProfessionalsManager;