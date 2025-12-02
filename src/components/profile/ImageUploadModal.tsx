import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (imageUrl: string) => Promise<void>;
  fieldLabel: string;
  currentImageUrl?: string;
  professionalId: string;
}

export default function ImageUploadModal({
  open,
  onClose,
  onSave,
  fieldLabel,
  currentImageUrl,
  professionalId
}: ImageUploadModalProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please choose an image smaller than 5MB.",
          variant: "destructive"
        });
        return;
      }
      
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadAndSave = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    try {
      // Upload to Supabase storage
      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${professionalId}-${Date.now()}.${fileExt}`;
      const filePath = `profile-photos/${fileName}`;

      console.log('Uploading file to:', filePath);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('professional-photos')
        .upload(filePath, selectedFile, { 
          upsert: true,
          contentType: selectedFile.type
        });

      if (uploadError) {
        console.error('Upload error details:', uploadError);
        throw uploadError;
      }

      console.log('Upload successful:', uploadData);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('professional-photos')
        .getPublicUrl(filePath);

      console.log('Public URL:', publicUrl);

      await onSave(publicUrl);
      
      toast({
        title: "Image Uploaded",
        description: "Your photo has been uploaded successfully."
      });
      
      handleClose();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload {fieldLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Current Image</Label>
            <div className="w-32 h-32 rounded-lg border border-border overflow-hidden bg-muted flex items-center justify-center">
              {currentImageUrl ? (
                <img src={currentImageUrl} alt="Current" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>New Image</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {previewUrl ? (
              <div className="w-32 h-32 rounded-lg border border-primary overflow-hidden">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-24 border-dashed"
              >
                <Upload className="h-6 w-6 mr-2" />
                Choose Image
              </Button>
            )}

            {previewUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose Different Image
              </Button>
            )}
            
            <p className="text-xs text-muted-foreground">
              Accepts JPG, PNG, or WebP. Max 5MB.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUploadAndSave} disabled={uploading || !selectedFile}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
