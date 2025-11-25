import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Professional } from "@/types/professional";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  professional: Professional;
  onUpdate: () => void;
}

export const EditProfileModal = ({ isOpen, onClose, professional, onUpdate }: EditProfileModalProps) => {
  const [loading, setLoading] = useState(false);
  const [verifyingLicense, setVerifyingLicense] = useState(false);
  const [formData, setFormData] = useState({
    license_number: professional.license_number || "",
    total_sales: (professional as any).total_sales || 0,
    years_experience: professional.years_experience || 0,
    description: professional.description || "",
    website: professional.website || "",
    phone: professional.phone || "",
    email: professional.email || "",
    zillow_profile_url: (professional as any).zillow_profile_url || "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile) return null;

    const fileExt = photoFile.name.split('.').pop();
    const fileName = `${professional.id}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('professional-photos')
      .upload(filePath, photoFile, { upsert: true });

    if (uploadError) {
      console.error('Error uploading photo:', uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('professional-photos')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const verifyLicense = async (licenseNumber: string) => {
    setVerifyingLicense(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-arizona-license', {
        body: { licenseNumber, professionalId: professional.id }
      });

      if (error) throw error;

      if (data?.verified) {
        toast.success("License verified successfully!");
        return true;
      } else {
        toast.info("License not found in Arizona records, using your entry");
        return false;
      }
    } catch (error) {
      console.error('Error verifying license:', error);
      toast.error("Could not verify license, using your entry");
      return false;
    } finally {
      setVerifyingLicense(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let photoUrl = (professional as any).image_url;

      // Upload photo if changed
      if (photoFile) {
        photoUrl = await uploadPhoto();
      }

      // Verify license if changed
      let licenseVerified = !!(professional as any).license_verified_at;
      if (formData.license_number !== professional.license_number) {
        licenseVerified = await verifyLicense(formData.license_number);
      }

      // Update professional record
      const updateData: any = {
        license_number: formData.license_number,
        total_sales: parseInt(formData.total_sales.toString()) || 0,
        years_experience: parseInt(formData.years_experience.toString()) || 0,
        description: formData.description,
        website: formData.website,
        phone: formData.phone,
        email: formData.email,
        zillow_profile_url: formData.zillow_profile_url,
      };

      if (photoUrl) {
        updateData.image_url = photoUrl;
      }

      if (licenseVerified) {
        updateData.license_verified_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('professionals')
        .update(updateData)
        .eq('id', professional.id);

      if (error) throw error;

      toast.success("Profile updated successfully!");
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Your Profile</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo Upload */}
          <div className="space-y-2">
            <Label>Profile Photo</Label>
            <div className="flex items-center gap-4">
              {(photoPreview || (professional as any).image_url) && (
                <img
                  src={photoPreview || (professional as any).image_url || ""}
                  alt="Preview"
                  className="w-20 h-20 rounded-full object-cover"
                />
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="flex-1"
              />
            </div>
          </div>

          {/* License Number */}
          <div className="space-y-2">
            <Label htmlFor="license">Arizona License Number</Label>
            <Input
              id="license"
              value={formData.license_number}
              onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
              placeholder="Enter license number"
            />
          </div>

          {/* Total Sales */}
          <div className="space-y-2">
            <Label htmlFor="sales">Total Sales</Label>
            <Input
              id="sales"
              type="number"
              value={formData.total_sales}
              onChange={(e) => setFormData({ ...formData, total_sales: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>

          {/* Years Experience */}
          <div className="space-y-2">
            <Label htmlFor="years">Years of Experience</Label>
            <Input
              id="years"
              type="number"
              value={formData.years_experience}
              onChange={(e) => setFormData({ ...formData, years_experience: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Tell clients about yourself..."
              rows={5}
            />
          </div>

          {/* Website */}
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://yourwebsite.com"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(555) 123-4567"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="your@email.com"
            />
          </div>

          {/* Zillow Profile */}
          <div className="space-y-2">
            <Label htmlFor="zillow">Zillow Profile URL</Label>
            <Input
              id="zillow"
              type="url"
              value={formData.zillow_profile_url}
              onChange={(e) => setFormData({ ...formData, zillow_profile_url: e.target.value })}
              placeholder="https://www.zillow.com/profile/..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading || verifyingLicense}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || verifyingLicense}>
              {(loading || verifyingLicense) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {verifyingLicense ? "Verifying License..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
