import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MoreVertical, Sparkles } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProfileSynthesizer } from "./ProfileSynthesizer";

interface ProfessionalActionsMenuProps {
  professionalId: string;
  professionalName: string;
  onActionComplete?: () => void;
}

export function ProfessionalActionsMenu({ 
  professionalId, 
  professionalName,
  onActionComplete 
}: ProfessionalActionsMenuProps) {
  const [showSynthesizerDialog, setShowSynthesizerDialog] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowSynthesizerDialog(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            Synthesize Profile
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showSynthesizerDialog} onOpenChange={setShowSynthesizerDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Synthesize Profile: {professionalName}</DialogTitle>
          </DialogHeader>
          <ProfileSynthesizer
            professionalId={professionalId}
            professionalName={professionalName}
            onSuccess={() => {
              setShowSynthesizerDialog(false);
              if (onActionComplete) onActionComplete();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}